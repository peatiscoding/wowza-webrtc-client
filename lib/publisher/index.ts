import { WebRTCConfiguration } from '../interface'
import { SDPMessageProcessor } from './SDPMessageProcessor'
import { forEach } from 'lodash'
import { supportGetUserMedia, queryForCamera, getUserMedia, createWebSocket } from '../utils'
import { Logger } from '../logger';

export class WebRTCPublisher {

  private userAgent = navigator.userAgent
  private localStream?: MediaStream                         // if set, preview stream is available.
  private currentContraints: MediaStreamConstraints = {
    video: true,                // default = no-facing-mode
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

  public get streamSourceConstraints(): MediaStreamConstraints {
    return this.currentContraints
  }

  public get lastError(): Error|undefined {
    return this._lastError
  }

  public get rtcPeerConnectionState(): RTCPeerConnectionState|undefined {
    return this.peerConnection && this.peerConnection.connectionState
  }

  public get rtcSignalingState(): RTCSignalingState|undefined {
    return this.peerConnection && this.peerConnection.signalingState
  }

  public get rtcIceConnectionState(): RTCIceConnectionState|undefined {
    return this.peerConnection && this.peerConnection.iceConnectionState
  }

  constructor(private config: WebRTCConfiguration, mediaStreamConstraints: MediaStreamConstraints, public enhanceMode: 'auto'|boolean, public codecMode: 'VPX'|'H264', private statusListener?: () => void) {
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
    
    // Update constraints.
    this.currentContraints = mediaStreamConstraints

    console.log('WebRTC Handler started (agent=', this.userAgent, this.currentContraints, ')')
    queryForCamera(this.streamSourceConstraints)
      .then(hasCamera => this.isCameraMuted = !hasCamera)
      .catch(error => {
        console.error('[Publisher] Unable to locate Camera', error)
      })
  }

  public async switchStream(constraints: MediaStreamConstraints, force: boolean = false) {
    const current = JSON.stringify(this.currentContraints)
    const target = JSON.stringify(constraints)
    if (!force && current === target) {
      console.log('[Publisher] Constraints already matched. ignore switchStream request.')
      return
    }
    this.currentContraints = constraints

    // Disable current stream before claiming a new one.
    if (this.localStream) {
      // stop current tracks
      const ls = this.localStream as any
      if (ls.stop) {
        ls.stop()
      } else {
        this.localStream.getTracks().forEach(o => o.stop())
      }
    }
    
    await this._claimMedia(constraints)
  }

  /**
   * Attach user media to configured VideoElement
   */
  public async attachUserMedia(videoElement: HTMLVideoElement) {
    // save videoElement
    this.videoElement = videoElement

    // Claim the stream
    await this._claimMedia(this.streamSourceConstraints)
  }
  
  private async _claimMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
    // Try getting user media.
    const stream = await getUserMedia(constraints)

    // Camera is not muted. (Camera is available.)
    this.isCameraMuted = false

    // If videoElement exists - attach it.
    if (this.videoElement) {
      try {
        this.videoElement.srcObject = stream
      } catch(elementError) {
        console.error('[Publisher] attaching video.srcObject failed, Fallback to src ...', this.videoElement, stream)
        this.videoElement.src = window.URL.createObjectURL(stream)
      }
    }

    // If peerConnection exists - replace it.
    const peerConnection = this.peerConnection
    if (peerConnection) {
      // Replace track
      stream.getTracks().forEach((track) => {
        const sender = peerConnection.getSenders().find((sender) => {
          return sender.track && sender.track.kind == track.kind || false
        })
        sender && sender.replaceTrack(track)
      })
    }

    // Select the stream to Local Stream.
    this.localStream = stream

    // status updated.
    this.statusListener && this.statusListener()

    return stream
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
   * 
   * @throws Error upon failure to create connection.
   */
  public async connect(streamName: string) {
    try {
      console.log('Trying to connect with ', streamName)
      this._lastError = undefined
      this.statusListener && this.statusListener()
      await this._connect(streamName)
      console.log('Publishing stream', streamName)
    } catch (error) {
      // handle error
      this._reportError(error)
      throw error
    }
  }

  /**
   * Try to connect to Wowza Server. Will fullfill when stream has been completely established.
   * 
   * @param streamName 
   */
  private async _connect(streamName: string): Promise<void> {
    if (this.peerConnection) {
      throw new Error('There is already an active peerConnection!')
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
    let wsConnection = await createWebSocket(wsURL)
    wsConnection.binaryType = 'arraybuffer'

    wsConnection.onclose = () => console.log('[Publisher] wsConnection.onclose')

    wsConnection.onerror = (evt) => {
      console.log("[Publisher] wsConnection.onerror: "+JSON.stringify(evt));
      this._reportError(new Error(JSON.stringify(evt)))
    }

    /**
     * await this when peer connection are well established.
     */
    const negotiationClosure = (offerMessage: string) => new Promise<void>((resolve, reject) => {
      console.log('[Publisher] enter nego closure!')
      wsConnection.onmessage = (evt: any) => {
        // Parse incoming message.
        const msgJSON = JSON.parse(evt.data)
        const msgStatus = Number(msgJSON['status'])
        const msgCommand = msgJSON['command']

        console.log('[Publisher] Incoming message', msgCommand)

        Logger.wrap('[Publisher] wsConnection.onMessage', async (console) => {

          if (!this.peerConnection) {
            throw new Error('Invalid state! peerConnection is empty!')
          }
          const peerConnection = this.peerConnection

          if (msgStatus != 200) {
            // Error
            throw new Error(`Failed to publish, cannot handle invalid status: ${msgStatus}`)
          }

          const sdpData = msgJSON['sdp']
          if (sdpData !== undefined) {
            console.log(`_ sdp: ${JSON.stringify(sdpData)}`)
            await peerConnection.setRemoteDescription(new RTCSessionDescription(sdpData))
          }

          const iceCandidates = msgJSON['iceCandidates']
          if (iceCandidates !== undefined) {
            for(const index in iceCandidates) {
              console.log('_ iceCandidates: ' + JSON.stringify(iceCandidates[index]));
              await peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidates[index]));
            }
          }

          // Connected! SDP Connection is no longer required.
          if (wsConnection != null) {
            wsConnection.close()
            this.statusListener && this.statusListener()
            resolve()
          }
        }).catch(reject)
      }

      wsConnection.send(offerMessage)
    })

    // save it.
    this.wsConnection = wsConnection

    console.log('[Publisher] wsConnection ready!')
    try {
      // Create Peer Connection Object
      const { pc: _pc, pcConnectedPromise } = this._createPeerConnection()
      
      // Create offer
      const description = await _pc.createOffer()
      console.log('[Publisher] offer created!', description)
      
      // SDP Munging - hijack SDP message to produce a selected SDP.
      if (this.enhanceMode === 'auto' || this.enhanceMode === true) {
        const originalSdp = description.sdp
        
        // enhance sdp message
        const enhancer = new SDPMessageProcessor(
          this.codecMode === 'VPX' ? 'VPX' : '42e01f',    // VideoMode: 'H264=42e01f' or 'VP9=VPX'
          'opus'    // AudioMode: 'OPUS'
        )
        description.sdp = enhancer.enhance(description.sdp, {
          audioBitrate,
          videoBitrate,
          videoFrameRate
        })
        
        if (this.enhanceMode === 'auto' && SDPMessageProcessor.isCorrupted(description.sdp)) {
          console.log('[Publisher] Bad SDP: ', description.sdp)
          console.log('[Publisher] ... revert')
          description.sdp = originalSdp
        } else {
          console.log('[Publisher] Auto Enhance SDPMessage is valid.')
        }
        console.log('[Publisher] Enhance mode updated!')
      }
        
      await _pc.setLocalDescription(description)
      console.log('[Publisher] Assigned local description!')
      
      // send offer back with enhanced SDP
      const offerMessage = '{"direction":"publish", "command":"sendOffer", "streamInfo":'+JSON.stringify(streamInfo)+', "sdp":'+JSON.stringify(description)+', "userData":'+JSON.stringify(this.userData)+'}'
      
      this.peerConnection = _pc
      this.statusListener && this.statusListener()
      
      console.log('[Publisher] Publishing with streamName=', streamName)

      // Waiting for Message result.
      await negotiationClosure(offerMessage)

      // Waiting for Connected state
      await pcConnectedPromise
    } catch(error) {
      console.error('[Publisher] Publishing stream failed', error)
      throw error
    }
  }

  /**
   * Set up peerConnection object with abundant event listeners.
   * 
   * @return RTCPeerConnection
   */
  private _createPeerConnection(): {pc: RTCPeerConnection, pcConnectedPromise: Promise<void>} {
    const localStream = this.localStream
    if (!localStream) {
      throw new Error('Invalid state, cannot open connection without video stream to publish.')
    }
    const peerConnection = new RTCPeerConnection({ iceServers: [] })
    peerConnection.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate != null) {
        console.log(`[Publisher] [PC] onIceCandidate: ${JSON.stringify({'ice': event.candidate})}`)
      }
    }

    const connectedPromise = new Promise<void>((resolve, reject) => {
      peerConnection.onicecandidateerror = (event: RTCPeerConnectionIceErrorEvent) => {
        const info = {
          errorCode: event.errorCode,
          errorText: event.errorText,
          hostCandidate: event.hostCandidate,
          url: event.url
        }
        console.error(`[Publisher] [PC] onIceCandidateError: ${JSON.stringify(info)}`)
        if (event.errorCode >= 300 && event.errorCode <= 699) {
          // STUN errors are in the range 300-699. See RFC 5389, section 15.6
          // for a list of codes. TURN adds a few more error codes; see
          // RFC 5766, section 15 for details.
          console.error('[Publisher] [PC] ... STUN errors.')
        }
        else if (event.errorCode >= 700 && event.errorCode <= 799) {
          // Server could not be reached; a specific error number is
          // provided but these are not yet specified.
          console.error('[Publisher] [PC] ... server could not be reached.')
        }
      }

      peerConnection.onsignalingstatechange = (ev: Event) => {
        const state: any = peerConnection.signalingState
        console.log(`[Publisher] [PC] onSignalingStateChange ⇀ ${state}`)
        this.statusListener && this.statusListener()
      }

      peerConnection.oniceconnectionstatechange = (ev: Event) => {
        const state: any = peerConnection.iceConnectionState
        console.log(`[Publisher] [PC] onIceConnectionStateChange ⇀ ${state}`)
        this.statusListener && this.statusListener()
      }

      /**
       * Aggregated connection state has been updated.
       * 
       * @see https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/connectionState
       */
      let isResolved = false
      peerConnection.onconnectionstatechange = (ev: Event) => {
        const state = peerConnection.connectionState
        console.log(`[Publisher] [PC] onConnectionStateChange ⇀ ${state}`)
        this.statusListener && this.statusListener()
        if (isResolved) return
        if (state === 'connected') {
          isResolved = true
          resolve()
        } else if (state === 'failed') {
          isResolved = true
          reject(new Error(`Peer Connection state is invalid: ${state}`))
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
    })

    return { pc: peerConnection, pcConnectedPromise: connectedPromise }
  }

  private _reportError(error: Error) {
    this._lastError = error
    this.disconnect()
  }

  public async disconnect() {
    if (this.peerConnection) {
      this.peerConnection.close()
      console.log('[Publisher] Remove peerConnection ... calling close()', this.peerConnection)
    } else {
      console.log('[Publisher] Remove peerConnection ... peerConnection already removed.', this.peerConnection)
    }
    if (this.wsConnection) {
      this.wsConnection.close()
      console.log('[Publisher] Remove wsConnection ... calling close()', this.wsConnection)
    } else {
      console.log('[Publisher] Remove wsConnection ... wsConnection already removed.')
    }

    this.peerConnection = undefined
    this.wsConnection = undefined

    this._stopStream()
    this.statusListener && this.statusListener()

    console.log("[Publisher] Disconnected")
  }

  private _stopStream() {
    // if there is a localStream object, and they are no longer used.
    console.log('[Publisher] stopping stream [localStream=', this.localStream, 'isPreviewEnabled=', this.isPreviewEnabled, 'isPublishing=', this.isPublishing, ']')
    if (this.localStream && !this.isPreviewEnabled && !this.isPublishing) {
      console.log('[Publisher] Trying to stop stream')
      const ls = this.localStream as any
      if (ls.stop) {
        ls.stop()
        console.log('[Publisher] Stopping localStream object.')
      } else {
        for(const track of this.localStream.getTracks()) {
          track.stop()
          console.log('[Publisher] Stopping localStream\'s track:', track)
        }
      }
      this.localStream = undefined
      console.log('[Publisher] Unbind local stream')
    }
  }
}
