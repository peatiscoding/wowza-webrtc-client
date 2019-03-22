import { WebRTCConfiguration } from '../interface'
import { SDPMessageProcessor } from './SDPMessageProcessor'
import { forEach } from 'lodash'
import { supportGetUserMedia, queryForCamera, getUserMedia } from '../utils'

export class WebRTCPublisher {

  private userAgent = navigator.userAgent
  private localStream?: MediaStream                         // if set, preview stream is available.
  private streamSourceConstraints: MediaStreamConstraints = {
    video: true,
    audio: true
  }
  private peerConnection?: RTCPeerConnection = undefined    // if set, we are publishing.
  private wsConnection?: WebSocket = undefined
  private userData = {param1:"value1"}
  private videoElement?: HTMLVideoElement = undefined

  private statusCameraMuted: boolean = true
  private _lastError?: Error = undefined

  /**
   * Holding = disable microphone only.
   */
  public get isHolding(): boolean {
    if (!this.localStream) {
      return false
    }
    const audioTracks = this.localStream.getAudioTracks()
    if (audioTracks.length > 0) {
      return !audioTracks[0].enabled
    }
    return false
  }

  public set isHolding(value: boolean) {
    if (!this.localStream) {
      return
    }
    forEach(this.localStream.getAudioTracks(), (track) => { track.enabled = !value })
    this.statusListener && this.statusListener()
  }

  public set isCameraMuted(muted: boolean) {
    this.statusCameraMuted = muted
    this.statusListener && this.statusListener()
  }

  public get isCameraMuted(): boolean {
    return this.statusCameraMuted
  }

  public get isPublishing(): boolean {
    return !!this.peerConnection
  }

  public get isPreviewEnabled(): boolean {
    return !!this.videoElement && (!!this.videoElement.src || !!this.videoElement.srcObject)
  }

  public get lastError(): Error|undefined {
    return this._lastError
  }

  constructor(private config: WebRTCConfiguration, private statusListener?: () => void) {
    // Validate if browser support getUserMedia or not?
    if (!supportGetUserMedia()) {
      throw new Error('Your browser does not support getUserMedia API')
    }

    // Normalize window/navigator APIs
    navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia
    window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection
    window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate
    window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription
    window.URL = window.URL || window.webkitURL

    console.log('WebRTC Handler started (agent=', this.userAgent, ')')
    queryForCamera(this.streamSourceConstraints)
      .then(hasCamera => this.isCameraMuted = !hasCamera)
      .catch(error => {
        console.error('[Publisher] Unable to locate Camera', error)
      })
  }

  /**
   * Attach user media to configured VideoElement
   */
  public async attachUserMedia(videoElement: HTMLVideoElement) {
    // Try getting user media.
    const stream = await getUserMedia(this.streamSourceConstraints)

    // Camera is not muted. (Camera is available.)
    this.isCameraMuted = false

    // Select the stream to Local Stream.
    this.localStream = stream

    try {
      videoElement.srcObject = stream
    } catch(elementError) {
      console.error('[Publisher] attaching video.srcObject failed, Fallback to src ...', videoElement, stream)
      videoElement.src = window.URL.createObjectURL(stream)
    }

    // save videoElement
    this.videoElement = videoElement

    // status updated.
    this.statusListener && this.statusListener()
  }

  public async detachUserMedia() {
    if (this.localStream) {
      if (this.videoElement && this.videoElement.src) {
        this.videoElement.src = ''
      }
      if (this.videoElement && this.videoElement.srcObject) {
        this.videoElement.srcObject = null
      }
      this._stopStream()
      this.statusListener && this.statusListener()
    }
  }

  /**
   * Begin connect to server, and publish the media.
   */
  public async connect(streamName: string) {
    if (this.peerConnection) {
      throw new Error('There is already active peerConnection!')
    }
    // grab configs
    const conf: WebRTCConfiguration = this.config
    const wsURL = conf.WEBRTC_SDP_URL
    const streamInfo = {
      applicationName: conf.WEBRTC_APPLICATION_NAME,
      streamName, 
      sessionId: "[empty]"    // random me!
    }
    const videoBitrate = conf.WEBRTC_VIDEO_BIT_RATE
    const audioBitrate = conf.WEBRTC_AUDIO_BIT_RATE
    const videoFrameRate = conf.WEBRTC_FRAME_RATE

    // wsConnect
    let wsConnection = new WebSocket(wsURL)
    wsConnection.binaryType = 'arraybuffer'

    wsConnection.onopen = async () => {
      console.log('[Publisher] wsConnection.onopen')

      const localStream = this.localStream
      if (!localStream) {
        const err = new Error('Invalid state, open connection without video stream to publish.')
        this._reportError(err)
        throw err
      }

      const peerConnection = new RTCPeerConnection({ iceServers: [] })
      peerConnection.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate != null) {
          console.log(`[Publisher] gotIceCandidate: ${JSON.stringify({'ice': event.candidate})}`)
        }
      }
  
      // Swizzle between Webkit API versions Support here ...
      const pc: any = peerConnection
      if (!pc.addStream) {
        {
          const localTracks = localStream.getTracks();
          for(const localTrack in localTracks) {
            peerConnection.addTrack(localTracks[localTrack], localStream);
          }
        }
      } else {
        pc.addStream(localStream)
      }

      // Create offer
      try {
        const description = await peerConnection.createOffer()

        // enhance sdp message
        const enhancer = new SDPMessageProcessor(
          '42e01f',    // VideoMode: 'H264=42e01f' or 'VP9=VP9'
          'opus'    // AudioMode: 'OPUS'
        )
        description.sdp = enhancer.enhance(description.sdp, {
          audioBitrate,
          videoBitrate,
          videoFrameRate
        })

        await peerConnection.setLocalDescription(description)

        // send offer back with enhanced SDP
        wsConnection.send('{"direction":"publish", "command":"sendOffer", "streamInfo":'+JSON.stringify(streamInfo)+', "sdp":'+JSON.stringify(description)+', "userData":'+JSON.stringify(this.userData)+'}');

        this.peerConnection = peerConnection
        this.statusListener && this.statusListener()

        console.log('[Publisher] Publishing with streamName=', streamName)

      } catch (error) {
        console.error('Failed while waiting for offer result', error)
        this._reportError(error)
      }
    }

    wsConnection.onmessage = async (evt: any) => {
      if (!this.peerConnection) {
        const err = new Error('Invalid state! peerConnection is empty!')
        this._reportError(err)
        throw err
      }

      const peerConnection = this.peerConnection
      const msgJSON = JSON.parse(evt.data)
      const msgStatus = Number(msgJSON['status'])
      const msgCommand = msgJSON['command']

      console.log('Incoming message', msgCommand)

      if (msgStatus != 200) {
        // Error
        const err = new Error(`Failed to publish, cannot handle invalid status: ${msgStatus}`)
        this._reportError(err)
        return
      }

      const sdpData = msgJSON['sdp']
      if (sdpData !== undefined) {
        console.log(`[Publisher] sdp: ${sdpData}`)

        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdpData))
      }

      const iceCandidates = msgJSON['iceCandidates']
      if (iceCandidates !== undefined) {
        for(const index in iceCandidates) {
          console.log('i[Publisher] ceCandidates: ' + iceCandidates[index]);
          await peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidates[index]));
        }
      }

      // Connected! SDP Connection is no longer required.
      if (wsConnection != null) {
        wsConnection.close()
      }
    }

    wsConnection.onclose = () => console.log('[Publisher] wsConnection.onclose')

    wsConnection.onerror = (evt) => {
      console.log("[Publisher] wsConnection.onerror: "+JSON.stringify(evt));
      this._reportError(new Error(JSON.stringify(evt)))
    }

    // save it.
    this.wsConnection = wsConnection
  }

  private _reportError(error: Error) {
    this._lastError = error
    this.disconnect()
  }

  public async disconnect() {
    this.peerConnection && this.peerConnection.close()
    this.wsConnection && this.wsConnection.close()

    this.peerConnection = undefined
    this.wsConnection = undefined

    this._stopStream()
    this.statusListener && this.statusListener()

    console.log("[Publisher] Disconnected")
  }

  private _stopStream() {
    // if there is a localStream object, and they are no longer used.
    if (this.localStream && !this.isPreviewEnabled && !this.isPublishing) {
      console.log('[Publisher] Trying to stop stream', this.localStream)
      if (this.localStream.stop) {
        this.localStream.stop()
      } else {
        for(const track of this.localStream.getTracks()) {
          track.stop()
        }
      }
      this.localStream = undefined
    }
  }
}
