package com.movieland.app;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdLoader;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.nativead.MediaView;
import com.google.android.gms.ads.nativead.NativeAd;
import com.google.android.gms.ads.nativead.NativeAdView;

/**
 * Small native overlay for the Android Native Advanced unit.
 *
 * The community Capacitor AdMob plugin does not expose NativeAdView, so this
 * bridge keeps the ad view on the native side where Google can register its
 * asset views and click tracking correctly. It is shown only above the app's
 * bottom navigation and is removed when the discovery screen unmounts.
 */
@CapacitorPlugin(name = "MovieLandNativeAds")
public class MovieLandNativeAdsPlugin extends Plugin {
    private FrameLayout overlay;
    private NativeAd nativeAd;

    @PluginMethod
    public void show(PluginCall call) {
        String adUnitId = call.getString("adId");
        if (adUnitId == null || adUnitId.isBlank()) {
            call.reject("A Native Advanced ad unit ID is required");
            return;
        }

        getActivity().runOnUiThread(() -> {
            removeOverlay();

            Context context = getActivity();
            NativeAdView adView = new NativeAdView(context);
            LinearLayout content = new LinearLayout(context);
            content.setOrientation(LinearLayout.VERTICAL);
            content.setPadding(dp(14), dp(10), dp(14), dp(10));
            content.setBackgroundColor(Color.rgb(25, 28, 34));

            TextView label = text(context, "ADVERTISEMENT", 10, Color.rgb(170, 177, 188));
            label.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
            content.addView(label, wrap());

            TextView headline = text(context, "Sponsored", 16, Color.WHITE);
            headline.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
            content.addView(headline, wrapWithTopMargin(6));

            MediaView mediaView = new MediaView(context);
            content.addView(mediaView, new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    dp(96)
            ));

            TextView body = text(context, "", 12, Color.rgb(205, 210, 218));
            content.addView(body, wrapWithTopMargin(5));

            Button cta = new Button(context);
            cta.setAllCaps(false);
            cta.setText("Learn more");
            content.addView(cta, wrapWithTopMargin(6));

            adView.setHeadlineView(headline);
            adView.setMediaView(mediaView);
            adView.setBodyView(body);
            adView.setCallToActionView(cta);
            adView.addView(content, new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.WRAP_CONTENT
            ));

            FrameLayout card = new FrameLayout(context);
            card.setBackgroundColor(Color.rgb(25, 28, 34));
            card.addView(adView, new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.WRAP_CONTENT
            ));

            TextView close = text(context, "×", 22, Color.WHITE);
            close.setGravity(Gravity.CENTER);
            close.setContentDescription("Close advertisement");
            close.setOnClickListener(view -> removeOverlay());
            FrameLayout.LayoutParams closeParams = new FrameLayout.LayoutParams(dp(36), dp(36), Gravity.TOP | Gravity.END);
            card.addView(close, closeParams);

            overlay = card;
            FrameLayout root = getActivity().findViewById(android.R.id.content);
            FrameLayout.LayoutParams overlayParams = new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.WRAP_CONTENT,
                    Gravity.BOTTOM
            );
            overlayParams.setMargins(dp(10), 0, dp(10), dp(76));
            root.addView(overlay, overlayParams);

            AdLoader loader = new AdLoader.Builder(context, adUnitId)
                    .forNativeAd(loadedAd -> {
                        if (overlay != card) {
                            loadedAd.destroy();
                            call.resolve();
                            return;
                        }
                        nativeAd = loadedAd;
                        headline.setText(loadedAd.getHeadline());
                        body.setText(loadedAd.getBody() == null ? "" : loadedAd.getBody());
                        cta.setText(loadedAd.getCallToAction() == null ? "Learn more" : loadedAd.getCallToAction());
                        if (loadedAd.getMediaContent() != null) {
                            mediaView.setMediaContent(loadedAd.getMediaContent());
                        }
                        adView.setNativeAd(loadedAd);
                        call.resolve();
                    })
                    .withAdListener(new AdListener() {
                        @Override
                        public void onAdFailedToLoad(@NonNull LoadAdError error) {
                            removeOverlay();
                            call.reject("Native Advanced ad failed to load", error.toString());
                        }
                    })
                    .build();
            loader.loadAd(new AdRequest.Builder().build());
        });
    }

    @PluginMethod
    public void hide(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            removeOverlay();
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        removeOverlay();
        super.handleOnDestroy();
    }

    private void removeOverlay() {
        if (overlay != null) {
            View parent = (View) overlay.getParent();
            if (parent instanceof FrameLayout) {
                ((FrameLayout) parent).removeView(overlay);
            }
            overlay = null;
        }
        if (nativeAd != null) {
            nativeAd.destroy();
            nativeAd = null;
        }
    }

    private TextView text(Context context, String value, int size, int color) {
        TextView view = new TextView(context);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        return view;
    }

    private LinearLayout.LayoutParams wrap() {
        return new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    }

    private LinearLayout.LayoutParams wrapWithTopMargin(int margin) {
        LinearLayout.LayoutParams params = wrap();
        params.topMargin = dp(margin);
        return params;
    }

    private int dp(int value) {
        return Math.round(value * getActivity().getResources().getDisplayMetrics().density);
    }
}
