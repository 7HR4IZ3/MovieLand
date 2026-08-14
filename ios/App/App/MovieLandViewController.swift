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
        "vidapi.xyz",
        "share.cdnm.ink",
        "cdnm.ink",
        "www.nontongo.win",
        "nontongo.win",
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
