# Wowza Streaming Engine WebRTC Client

- Written in TypeScript.

## Install

```
npm i wowza-webrtc-client -s # yarn add wowza-webrtc-client
```

## Usage

In Typescript

**Configuration**

```
import { WebRTCConfiguration } from 'wowza-webrtc-client'

const config: WebRTCConfiguration = {
  WEBRTC_SDP_URL: 'wss://mydomain.streamlock.net/webrtc-session.json',
  WEBRTC_APPLICATION_NAME: 'webrtc',
  WEBRTC_FRAME_RATE: 29,
  WEBRTC_AUDIO_BIT_RATE: 64,
  WEBRTC_VIDEO_BIT_RATE: 360,
}
```

**Using Player**

```
const $video = document.querySelectorAll('video')[0]
const statusHandler = (isMuted, isPlaying, error) => {
  console.log('Status has invalidated', isMuted, isPlaying, error)
}
const playerInterface = WebRTCPlayer(config, $video, statusHandler)

# Use playerInterface to control your stream

const streamName = '12345-test-stream'
playerInterface.connect(streamName)

# later
playerInterface.stop()
```

**Using Publisher**

```
const $preview = document.querySelectorAll('video')[0]

const statusInvalidated = () => {
  console.log({
    isCameraReady: !this.handler.isCameraMuted,
    isHolding: this.handler.isHolding,
    isPublishing: this.handler.isPublishing,
    isPreviewEnabled: this.isPreviewEnabled,
    publisherError: this.handler.lastError
  })
}

const handler = new PublisherHandler(config, statusInvalidated)

const startPreview = () => {
  handler.attachUserMedia($preview)
}

const startPublishing = (streamName: string) => {
  handler.connect(streamName)
}

const stopPublishing = () => {
  handler.disconnect()
}

const stopPreview = () => {
  handler.stopPreview()
}
```
