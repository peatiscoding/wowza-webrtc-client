interface Window {
  // For WebRTC
  RTCPeerConnection: any
  mozRTCPeerConnection: any
  webkitRTCPeerConnection: any
  RTCIceCandidate: any
  mozRTCIceCandidate: any
  webkitRTCIceCandidate: any
  RTCSessionDescription: any
  mozRTCSessionDescription: any
  webkitRTCSessionDescription: any
  webkitURL: any
  cnsl_debug: boolean | undefined
}

interface Navigator {
  // For WebRTC
  mozGetUserMedia?: (constraints: MediaStreamConstraints, successCallback: NavigatorUserMediaSuccessCallback, errorCallback: NavigatorUserMediaErrorCallback) => void
  webkitGetUserMedia?: (constraints: MediaStreamConstraints, successCallback: NavigatorUserMediaSuccessCallback, errorCallback: NavigatorUserMediaErrorCallback) => void
}
