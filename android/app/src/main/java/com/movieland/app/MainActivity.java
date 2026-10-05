package com.movieland.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(MovieLandNativeAdsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
