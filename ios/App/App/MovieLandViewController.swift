import UIKit
import WebKit
import Capacitor

/// The native iOS shell for MovieLand.
///
/// Capacitor owns the WebView's normal delegation handler. We install a small
/// proxy after Capacitor has finished creating the WebView so navigation policy
/// can be enforced without replacing Capacitor's internal behavior.
final class MovieLandViewController: CAPBridgeViewController {
    private var navigationDelegateProxy: MovieLandNavigationDelegate?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(MovieLandDownloadPlugin.shared)

        guard let webView else { return }

        let downstream = webView.navigationDelegate
        let proxy = MovieLandNavigationDelegate(
            downstream: downstream,
            appScheme: bridge?.config.localURL.scheme ?? "capacitor",
            appHost: bridge?.config.localURL.host ?? "localhost"
        )

        navigationDelegateProxy = proxy
        webView.navigationDelegate = proxy
    }
}

/// Native, resumable downloads for direct media URLs supplied by a provider
/// adapter. Embed URLs are intentionally not accepted by the web layer as
/// media sources because downloading them would only save the HTML player.
@objc(MovieLandDownloadPlugin)
final class MovieLandDownloadPlugin: CAPPlugin, CAPBridgedPlugin, URLSessionDownloadDelegate {
    static let shared = MovieLandDownloadPlugin()
    static var backgroundEventsCompletion: (() -> Void)?

    let identifier = "MovieLandDownloadPlugin"
    let jsName = "MovieLandDownload"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "list", returnType: CAPPluginReturnPromise),
    ]

    private struct Record: Codable {
        var id: String
        var url: String
        var fileName: String
        var status: String
        var bytesDownloaded: Int64 = 0
        var totalBytes: Int64 = 0
        var speedBytesPerSecond: Double = 0
        var localPath: String?
        var error: String?
        var resumeDataBase64: String?

        var payload: [String: Any] {
            var value: [String: Any] = [
                "id": id,
                "status": status,
                "bytesDownloaded": Double(bytesDownloaded),
                "totalBytes": Double(totalBytes),
                "speedBytesPerSecond": speedBytesPerSecond,
            ]
            if let localPath { value["localPath"] = localPath }
            if let error { value["error"] = error }
            return value
        }
    }

    private let storageKey = "movieland.native.downloads"
    private var records: [String: Record] = [:]
    private var tasks: [String: URLSessionDownloadTask] = [:]
    private var lastProgressAt: [String: Date] = [:]
    private var lastProgressBytes: [String: Int64] = [:]
    private var reconnected = false

    private lazy var session: URLSession = {
        let configuration = URLSessionConfiguration.background(withIdentifier: "com.movieland.app.downloads")
        configuration.isDiscretionary = false
        configuration.sessionSendsLaunchEvents = true
        return URLSession(configuration: configuration, delegate: self, delegateQueue: OperationQueue.main)
    }()

    override func load() {
        super.load()
        reconnectDownloads()
    }

    func reconnectDownloads() {
        guard !reconnected else { return }
        reconnected = true
        loadRecords()
        session.getAllTasks { [weak self] activeTasks in
            DispatchQueue.main.async {
                guard let self else { return }
                for case let task as URLSessionDownloadTask in activeTasks {
                    guard let id = task.taskDescription, self.records[id] != nil else { continue }
                    self.tasks[id] = task
                }
            }
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let urlString = call.getString("url"), let url = URL(string: urlString), let fileName = call.getString("fileName") else {
            call.reject("A download id, URL, and file name are required")
            return
        }
        guard url.scheme == "http" || url.scheme == "https" else {
            call.reject("Only HTTP and HTTPS media URLs can be downloaded")
            return
        }

        var record = records[id] ?? Record(id: id, url: urlString, fileName: fileName, status: "queued")
        record.url = urlString
        record.fileName = fileName
        record.error = nil
        records[id] = record
        launch(id: id, call: call)
    }

    @objc func pause(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let task = tasks[id] else {
            call.reject("Download is not active")
            return
        }

        task.cancel { [weak self] data in
            DispatchQueue.main.async {
                guard let self, var record = self.records[id] else {
                    call.reject("Download no longer exists")
                    return
                }
                self.tasks[id] = nil
                if let data {
                    record.resumeDataBase64 = data.base64EncodedString()
                }
                record.status = "paused"
                record.speedBytesPerSecond = 0
                self.records[id] = record
                self.saveRecords()
                self.emit(record)
                call.resolve(record.payload)
            }
        }
    }

    @objc func resume(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), records[id] != nil else {
            call.reject("Download no longer exists")
            return
        }
        launch(id: id, call: call)
    }

    @objc func remove(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else {
            call.reject("A download id is required")
            return
        }
        tasks[id]?.cancel()
        tasks[id] = nil
        if let record = records[id], let path = record.localPath {
            try? FileManager.default.removeItem(atPath: path)
        }
        records[id] = nil
        saveRecords()
        call.resolve()
    }

    @objc func list(_ call: CAPPluginCall) {
        call.resolve(["items": records.values.map { $0.payload }])
    }

    private func launch(id: String, call: CAPPluginCall?) {
        guard var record = records[id], let url = URL(string: record.url) else {
            call?.reject("Download source is invalid")
            return
        }

        tasks[id]?.cancel()
        let task: URLSessionDownloadTask
        if let base64 = record.resumeDataBase64, let data = Data(base64Encoded: base64) {
            task = session.downloadTask(withResumeData: data)
        } else {
            task = session.downloadTask(with: URLRequest(url: url))
        }
        task.taskDescription = id
        tasks[id] = task
        record.status = "downloading"
        record.error = nil
        record.resumeDataBase64 = nil
        records[id] = record
        lastProgressAt[id] = Date()
        lastProgressBytes[id] = record.bytesDownloaded
        saveRecords()
        emit(record)
        task.resume()
        call?.resolve(record.payload)
    }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        guard let id = downloadTask.taskDescription, var record = records[id] else { return }
        let now = Date()
        let previousTime = lastProgressAt[id] ?? now
        let previousBytes = lastProgressBytes[id] ?? totalBytesWritten
        let elapsed = now.timeIntervalSince(previousTime)
        record.bytesDownloaded = totalBytesWritten
        record.totalBytes = totalBytesExpectedToWrite > 0 ? totalBytesExpectedToWrite : 0
        if elapsed > 0.05 {
            record.speedBytesPerSecond = Double(max(0, totalBytesWritten - previousBytes)) / elapsed
            lastProgressAt[id] = now
            lastProgressBytes[id] = totalBytesWritten
        }
        record.status = "downloading"
        records[id] = record
        saveRecords()
        emit(record)
    }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        guard let id = downloadTask.taskDescription, var record = records[id] else { return }
        guard let response = downloadTask.response as? HTTPURLResponse, (200..<300).contains(response.statusCode) else {
            record.status = "failed"
            record.error = "The download server returned an unsuccessful HTTP response"
            record.speedBytesPerSecond = 0
            tasks[id] = nil
            records[id] = record
            saveRecords()
            emit(record)
            return
        }
        let destination = destinationURL(for: record)
        do {
            try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
            try? FileManager.default.removeItem(at: destination)
            try FileManager.default.moveItem(at: location, to: destination)
            record.localPath = destination.path
            record.status = "finished"
            record.speedBytesPerSecond = 0
            record.resumeDataBase64 = nil
            if record.totalBytes > 0 { record.bytesDownloaded = record.totalBytes }
            record.error = nil
        } catch {
            record.status = "failed"
            record.error = error.localizedDescription
        }
        tasks[id] = nil
        records[id] = record
        saveRecords()
        emit(record)
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let id = task.taskDescription, var record = records[id], let error else { return }
        if record.status == "paused" { return }
        if let resumeData = (error as NSError).userInfo[NSURLSessionDownloadTaskResumeData] as? Data {
            record.resumeDataBase64 = resumeData.base64EncodedString()
        }
        record.status = "failed"
        record.speedBytesPerSecond = 0
        record.error = error.localizedDescription
        tasks[id] = nil
        records[id] = record
        saveRecords()
        emit(record)
    }

    func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        MovieLandDownloadPlugin.backgroundEventsCompletion?()
        MovieLandDownloadPlugin.backgroundEventsCompletion = nil
    }

    private func destinationURL(for record: Record) -> URL {
        let safeName = record.fileName.replacingOccurrences(of: "/", with: "-")
        let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("Downloads", isDirectory: true)
        return directory.appendingPathComponent(safeName)
    }

    private func emit(_ record: Record) {
        notifyListeners("downloadProgress", data: record.payload)
    }

    private func loadRecords() {
        guard let data = UserDefaults.standard.data(forKey: storageKey), let saved = try? JSONDecoder().decode([Record].self, from: data) else { return }
        records = Dictionary(uniqueKeysWithValues: saved.map { ($0.id, $0) })
    }

    private func saveRecords() {
        guard let data = try? JSONEncoder().encode(Array(records.values)) else { return }
        UserDefaults.standard.set(data, forKey: storageKey)
    }
}

/// Forwards all navigation-delegate messages to Capacitor, while applying a
/// host allowlist to navigation requests first.
///
/// This protects the native app from provider links, pop-up targets, and ad
/// redirects navigating the top-level WebView away from MovieLand. Video and
/// other subresource requests are unaffected because they do not go through
/// WKNavigationDelegate navigation policy callbacks.
private final class MovieLandNavigationDelegate: NSObject, WKNavigationDelegate {
    private static let navigationActionSelector = Selector(
        "webView:decidePolicyForNavigationAction:decisionHandler:"
    )
    private static let navigationResponseSelector = Selector(
        "webView:decidePolicyForNavigationResponse:decisionHandler:"
    )

    weak var downstream: WKNavigationDelegate?
    private let appScheme: String
    private let appHost: String

    private let providerHosts = [
        "player.vidlove.cc",
        "vidlove.cc",
        "www.vidlove.cc",
        "vidapi.xyz",
        "share.cdnm.ink",
        "cdnm.ink",
        "www.nontongo.win",
        "nontongo.win",
        "111movies.net",
        "videasy.net",
    ]

    init(downstream: WKNavigationDelegate?, appScheme: String, appHost: String) {
        self.downstream = downstream
        self.appScheme = appScheme
        self.appHost = appHost
        super.init()
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard shouldAllowAction(navigationAction.request.url, targetFrame: navigationAction.targetFrame) else {
            logBlocked(navigationAction.request.url)
            decisionHandler(.cancel)
            return
        }

        forwardNavigationAction(
            webView,
            navigationAction: navigationAction,
            decisionHandler: decisionHandler
        )
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationResponse: WKNavigationResponse,
        decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void
    ) {
        guard shouldAllow(navigationResponse.response.url) else {
            logBlocked(navigationResponse.response.url)
            decisionHandler(.cancel)
            return
        }

        forwardNavigationResponse(
            webView,
            navigationResponse: navigationResponse,
            decisionHandler: decisionHandler
        )
    }

    override func responds(to selector: Selector!) -> Bool {
        if selector == Self.navigationActionSelector || selector == Self.navigationResponseSelector {
            return true
        }

        return downstream?.responds(to: selector) ?? super.responds(to: selector)
    }

    override func forwardingTarget(for selector: Selector!) -> Any? {
        if selector == Self.navigationActionSelector || selector == Self.navigationResponseSelector {
            return nil
        }

        return downstream
    }

    private func shouldAllowAction(_ url: URL?, targetFrame: WKFrameInfo?) -> Bool {
        // A nil target frame means a new window/tab request, which is how
        // most embedded-player pop-ups and ad links attempt to escape.
        guard targetFrame != nil else { return false }
        return shouldAllow(url)
    }

    private func shouldAllow(_ url: URL?) -> Bool {
        guard let url else { return false }

        if url.isFileURL || url.scheme == "about" || url.scheme == "blob" || url.scheme == "data" {
            return true
        }

        guard let scheme = url.scheme?.lowercased() else { return false }

        if scheme == appScheme.lowercased() {
            return url.host?.lowercased() == appHost.lowercased()
        }

        guard scheme == "http" || scheme == "https",
              let host = url.host?.lowercased() else {
            return false
        }

        if host == appHost.lowercased() {
            return true
        }

        return providerHosts.contains { host == $0 || host.hasSuffix(".\($0)") }
    }

    private func logBlocked(_ url: URL?) {
        guard let url else { return }
        print("MovieLand blocked external WebView navigation: \(url.absoluteString)")
    }

    private func forwardNavigationAction(
        _ webView: WKWebView,
        navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let downstream, downstream.responds(to: Self.navigationActionSelector) else {
            decisionHandler(.allow)
            return
        }

        downstream.webView?(
            webView,
            decidePolicyFor: navigationAction,
            decisionHandler: decisionHandler
        )
    }

    private func forwardNavigationResponse(
        _ webView: WKWebView,
        navigationResponse: WKNavigationResponse,
        decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void
    ) {
        guard let downstream, downstream.responds(to: Self.navigationResponseSelector) else {
            decisionHandler(.allow)
            return
        }

        downstream.webView?(
            webView,
            decidePolicyFor: navigationResponse,
            decisionHandler: decisionHandler
        )
    }
}
