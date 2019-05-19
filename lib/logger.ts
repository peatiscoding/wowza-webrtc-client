import { concat } from 'lodash'

type Message = ['log'|'info'|'error', any[]]

export class Logger {
  private messages: Message[] = []

  public static async wrap<T>(domain: string, callback: (logger: Logger) => Promise<T>): Promise<T> {
    const lg = new Logger(domain)
    try {
      console.log('Start')
      return await callback(lg)
    } catch(error) {
      lg.error(error)
      throw error
    } finally {
      lg.flush()
    }
  }

  public constructor(private domain: string) {
  }

  public info(...args: any[]) {
    this._l('info', args)
  }

  public error(...args: any[]) {
    this._l('error', args)
  }

  public log(...args: any[]) {
    this._l('log', args)
  }

  public flush() {
    this.messages.forEach((element: Message) => {
      console && console[element[0]] && console[element[0]].apply(console, element[1] as any)
    })
  }

  private _l(type: 'log'|'info'|'error', args: any[]) {
    this.messages.push([type, concat([this.domain], args)])
  }
}