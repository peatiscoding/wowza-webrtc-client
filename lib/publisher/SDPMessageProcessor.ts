import { cnsl } from '../utils'

export class SDPMessageProcessor {

  // Buffer and Flags
  private sdpOutput: { [key: number]: string } = {}
  private audioIndex = -1
  private videoIndex = -1

  constructor(private videoMode: '42e01f'|'VPX', private audioMode: string) {
  }

  public enhance(_sdpStr?: string, enhanceData?: any): string {
    cnsl.log('[Publisher] Enhancing SDP ...', this.videoMode, this.audioMode)
    let sdpStr = _sdpStr || ''
    let sdpLines = sdpStr.split(/\r\n/);
    let sdpSection: 'audio'|'video'|'bandwidth'|'header' = 'header'
    let hitMID = false
    let sdpStrRet = ''
  
    // Firefox provides a reasonable SDP, Chrome is just odd
    // so we have to doing a little mundging to make it all work
    if ( !sdpStr.includes("THIS_IS_SDPARTA") || this.videoMode === 'VPX' ) {
      for(const sdpIndex in sdpLines) {
        const sdpLine = sdpLines[sdpIndex]
  
        // Skip empty line
        if (sdpLine.length <= 0)
          continue
  
        const doneCheck = this.checkLine(sdpLine);
        if (!doneCheck)
          continue
  
        sdpStrRet += sdpLine
        sdpStrRet += '\r\n'
      }
      sdpStrRet = this.addAudio(sdpStrRet, this.deliverCheckLine(this.audioMode, 'audio'))
      sdpStrRet = this.addVideo(sdpStrRet, this.deliverCheckLine(this.videoMode, 'video'))
      sdpStr = sdpStrRet
      sdpLines = sdpStr.split(/\r\n/)
      sdpStrRet = ''
    }
  
    for(const sdpIndex in sdpLines) {
      const sdpLine = sdpLines[sdpIndex];
  
      // Skip empty line
      if (sdpLine.length <= 0)
        continue
  
      if (sdpLine.indexOf('m=audio') == 0 && this.audioIndex !=-1) {
        const audioMLines = sdpLine.split(' ')
        sdpStrRet += audioMLines[0]+" "+audioMLines[1]+" "+audioMLines[2]+" "+this.audioIndex + '\r\n'
        continue
      }
  
      if ( sdpLine.indexOf("m=video") == 0 && this.videoIndex !=-1 ) {
        const videoMLines = sdpLine.split(" ");
        sdpStrRet += videoMLines[0]+" "+videoMLines[1]+" "+videoMLines[2]+" "+this.videoIndex + '\r\n'
        continue
      }
  
      sdpStrRet += sdpLine;
  
      if (sdpLine.indexOf("m=audio") === 0) {
        sdpSection = 'audio'
        hitMID = false
      } else if (sdpLine.indexOf("m=video") === 0) {
        sdpSection = 'video'
        hitMID = false
      } else if (sdpLine.indexOf("a=rtpmap") == 0 ) {
        sdpSection = 'bandwidth'
        hitMID = false
      }
  
      if (sdpLine.indexOf("a=mid:") === 0 || sdpLine.indexOf("a=rtpmap") == 0 ) {
        if (!hitMID) {
          if ('audio'.localeCompare(sdpSection) == 0) {
            if (enhanceData.audioBitrate !== undefined) {
              sdpStrRet += '\r\nb=CT:' + (enhanceData.audioBitrate)
              sdpStrRet += '\r\nb=AS:' + (enhanceData.audioBitrate)
            }
            hitMID = true
          } else if ('video'.localeCompare(sdpSection) == 0) {
            if (enhanceData.videoBitrate !== undefined) {
              sdpStrRet += '\r\nb=CT:' + (enhanceData.videoBitrate)
              sdpStrRet += '\r\nb=AS:' + (enhanceData.videoBitrate)
              if (enhanceData.videoFrameRate !== undefined) {
                sdpStrRet += '\r\na=framerate:'+enhanceData.videoFrameRate
              }
            }
            hitMID = true
          } else if ('bandwidth'.localeCompare(sdpSection) == 0 ) {
            const rtpmapID = this.getrtpMapID(sdpLine);
            if (rtpmapID !== null) {
              const match = rtpmapID[2].toLowerCase()
              if ( ('vp9'.localeCompare(match) == 0 ) ||  ('vp8'.localeCompare(match) == 0 ) || ('h264'.localeCompare(match) == 0 ) ||
                ('red'.localeCompare(match) == 0 ) || ('ulpfec'.localeCompare(match) == 0 ) || ('rtx'.localeCompare(match) == 0 ) ) {
                if (enhanceData.videoBitrate !== undefined) {
                  sdpStrRet+='\r\na=fmtp:'+rtpmapID[1]+' x-google-min-bitrate='+(enhanceData.videoBitrate)+';x-google-max-bitrate='+(enhanceData.videoBitrate);
                }
              }
  
              if ( ('opus'.localeCompare(match) == 0 ) ||  ('isac'.localeCompare(match) == 0 ) || ('g722'.localeCompare(match) == 0 ) || ('pcmu'.localeCompare(match) == 0 ) ||
                  ('pcma'.localeCompare(match) == 0 ) || ('cn'.localeCompare(match) == 0 )) {
                if (enhanceData.audioBitrate !== undefined) {
                  sdpStrRet+='\r\na=fmtp:'+rtpmapID[1]+' x-google-min-bitrate='+(enhanceData.audioBitrate)+';x-google-max-bitrate='+(enhanceData.audioBitrate)
                }
              }
            }
          }
        }
      }
      sdpStrRet += '\r\n'
    }
    if (this.videoMode === '42e01f') {
      return this.forceH264(sdpStrRet)
    }
    return sdpStrRet
  }

  /**
   * Fix Huawei OS failed to handle H264 configuration correctly..
   * 
   * @param sdp 
   */
  private forceH264(sdp: string): string {
    cnsl.log(`Forcing SDP: ${sdp}`)
    return sdp.replace(/(profile-level-id)=(42001f|64C016)/i, '$1=42e01f')
        // .replace(/([\r\n]{2})[^=]+([a-z]=)/g, '$1$2')
  }

  /**
   * Detect corrupted SDP message.
   * @param sdpMessage 
   */
  public static isCorrupted(sdpMessage: string): boolean {
    return /([\r\n]{2})[^=]+([a-z]=)/.test(sdpMessage)
  }

  /**
   * Select the matched SDP.
   * 
   * @param profile 
   * @param type 
   */
  private deliverCheckLine(profile: string, type: 'video'|'audio'): string {
    let outputString = ''
    for(const line in this.sdpOutput) {
      const lineInUse = this.sdpOutput[line]
      outputString += line
      if (lineInUse.includes(profile) || 'VPX' === profile && /VP(8|9)/.test(lineInUse)) {
        if (profile === 'VPX') {
          let output = ''
          const outputs = lineInUse.split(/\r\n/)
          for(const position in outputs) {
            const transport = outputs[position]
            if (transport.indexOf("transport-cc") !== -1 || transport.indexOf("goog-remb") !== -1 || transport.indexOf("nack") !== -1) {
              continue
            }
            output += transport
            output += '\r\n'
          }

          if (type.includes('audio')) {
            this.audioIndex = +line
          }

          if (type.includes('video') ) {
            this.videoIndex = +line
          }
          return output
        }
        if (type.includes('audio') ) {
          this.audioIndex = +line
        }

        if (type.includes('video') ) {
          this.videoIndex = +line
        }
        return lineInUse
      }
    }
    return outputString
  }

  // Collect SDP Output format. And buffer them for selection through `deliverCheckLine` method.
  // This method will index SDP messages as 
  // {
  //    [codecId]: <sdp_output_message>
  // }
  private checkLine(line: string): boolean {
    if (line.startsWith('a=rtpmap') || line.startsWith('a=rtcp-fb') || line.startsWith('a=fmtp')) {
      const res = line.split(':')
      if (res.length > 1) {
        const number = res[1].split(" ")
        if (!isNaN(+number[0])) {
          if (!number[1].startsWith('http') && !number[1].startsWith('ur')) {
            let currentString = this.sdpOutput[number[0]]
            if (!currentString) {
              currentString = ''
            }
            currentString += line + '\r\n'
            this.sdpOutput[+number[0]] = currentString
            return false
          }
        }
      }
    }
    return true
  }

  private getrtpMapID(line: string): RegExpMatchArray|null {
    const findid = new RegExp('a=rtpmap:(\\d+) (\\w+)/(\\d+)')
    const found = line.match(findid)
    return (found && found.length >= 3) ? found : null
  }

  private addVideo(sdpStr: string, videoLine: string) {
    const sdpLines = sdpStr.split(/\r\n/)
    let sdpStrRet = ''
    let done = false
  
    let rtcpSize = false
  
    for(const sdpIndex in sdpLines) {
      const sdpLine = sdpLines[sdpIndex]

      if (sdpLine.length <= 0)
        continue
  
      if (sdpLine.includes("a=rtcp-rsize")) {
        rtcpSize = true
      }
  
      if (sdpLine.includes("a=rtcp-mux")) {
        // rtcpMux = true
      }
    }
  
    for(const sdpIndex in sdpLines) {
      const sdpLine = sdpLines[sdpIndex]
  
      sdpStrRet += sdpLine + '\r\n'
  
      if (('a=rtcp-rsize'.localeCompare(sdpLine) == 0 ) && done == false && rtcpSize == true) {
        sdpStrRet += videoLine
        done = true
      }
  
      if ( 'a=rtcp-mux'.localeCompare(sdpLine) == 0 && done == true && rtcpSize == false) {
        sdpStrRet += videoLine
        done = true
      }
  
      if ( 'a=rtcp-mux'.localeCompare(sdpLine) == 0 && done == false && rtcpSize == false ) {
        done = true
      }
  
    }
    return sdpStrRet
  }

  private addAudio(sdpStr: string, audioLine: string) {
    let sdpLines = sdpStr.split(/\r\n/)
    let sdpStrRet = '';
    let done = false;
  
    for(const sdpIndex in sdpLines) {
      const sdpLine = sdpLines[sdpIndex]
  
      if (sdpLine.length <= 0)
        continue

      sdpStrRet += sdpLine
      sdpStrRet += '\r\n'
  
      if ('a=rtcp-mux'.localeCompare(sdpLine) == 0 && done == false) {
        sdpStrRet += audioLine
        done = true
      }
    }
    return sdpStrRet
  }
}