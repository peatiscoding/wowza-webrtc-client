import { concat } from 'lodash'
import { cnsl } from './utils'

type Message = ['log'|'info'|'error', any[]]

export class Logger {
  private messages: Message[] = []

  public static async wrap<T>(domain: string, callback: (logger: Logger) => Promise<T>): Promise<T> {
    const lg = new Logger(domain)
    try {
      cnsl.log('Start')
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
      cnsl && cnsl[element[0]] && cnsl[element[0]].apply(cnsl, element[1] as any)
    })
  }

  private _l(type: 'log'|'info'|'error', args: any[]) {
    this.messages.push([type, concat([this.domain], args)])
  }
}