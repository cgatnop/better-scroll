import { BScrollInstance, propertiesConfig } from './Instance'
import { Options, DefOptions, OptionsConstructor } from './Options'
import Scroller from './scroller/Scroller'
import {
  getElement,
  warn,
  isUndef,
  propertiesProxy,
  ApplyOrder,
  EventEmitter
} from '@better-scroll/shared-utils'
import { bubbling } from './utils/bubbling'

interface PluginCtor {
  pluginName: string
  applyOrder?: ApplyOrder
  new (scroll: BScroll): any
}

interface PluginItem {
  name: string
  applyOrder?: ApplyOrder.Pre | ApplyOrder.Post
  ctor: PluginCtor
}
interface PluginsMap {
  [key: string]: boolean
}
interface PropertyConfig {
  key: string
  sourceKey: string
}

type ElementParam = HTMLElement | string

export class BScrollConstructor<O = {}> extends EventEmitter {
  static plugins: PluginItem[] = []
  static pluginsMap: PluginsMap = {}
  scroller: Scroller
  options: OptionsConstructor
  hooks: EventEmitter
  plugins: { [name: string]: any }
  wrapper: HTMLElement
  [key: string]: any

  static use(ctor: PluginCtor) {
    const name = ctor.pluginName
    const installed = BScrollConstructor.plugins.some(
      plugin => ctor === plugin.ctor
    )
    if (installed) return BScrollConstructor
    if (isUndef(name)) {
      warn(
        `Plugin Class must specify plugin's name in static property by 'pluginName' field.`
      )
      return BScrollConstructor
    }
    if (BScrollConstructor.pluginsMap[name]) {
      warn(
        `This plugin has been registered, maybe you need change plugin's name`
      )
      return BScrollConstructor
    }
    BScrollConstructor.pluginsMap[name] = true
    BScrollConstructor.plugins.push({
      name,
      applyOrder: ctor.applyOrder,
      ctor
    })
    return BScrollConstructor
  }

  constructor(el: ElementParam, options?: Options & O) {
    super([
      'refresh',
      'enable',
      'disable',
      'beforeScrollStart',
      'scrollStart',
      'scroll',
      'scrollEnd',
      'scrollCancel',
      'touchEnd',
      'flick',
      'destroy'
    ])

    const wrapper = getElement(el)

    if (!wrapper) {
      warn('Can not resolve the wrapper DOM.')
      return
    }
    const content = wrapper.children[0]
    if (!content) {
      warn('The wrapper need at least one child element to be scroller.')
      return
    }
    this.plugins = {}
    this.options = new OptionsConstructor().merge(options).process()
    this.hooks = new EventEmitter([
      'init',
      'refresh',
      'enable',
      'disable',
      'destroy'
    ])
    this.init(wrapper)
  }

  private init(wrapper: HTMLElement) {
    this.wrapper = wrapper

    // mark wrapper to recognize bs instance by DOM attribute
    ;(wrapper as any).isBScrollContainer = true
    this.scroller = new Scroller(wrapper as HTMLElement, this.options)

    this.eventBubbling()
    this.handleAutoBlur()

    this.innerRefresh()

    this.scroller.scrollTo(this.options.startX, this.options.startY)
    this.enable()

    this.proxy(propertiesConfig)

    this.applyPlugins()
  }

  private applyPlugins() {
    const options = this.options
    BScrollConstructor.plugins
      .sort((a, b) => {
        const applyOrderMap = {
          [ApplyOrder.Pre]: -1,
          [ApplyOrder.Post]: 1
        }
        const aOrder = a.applyOrder ? applyOrderMap[a.applyOrder] : 0
        const bOrder = b.applyOrder ? applyOrderMap[b.applyOrder] : 0
        return aOrder - bOrder
      })
      .forEach((item: PluginItem) => {
        const ctor = item.ctor
        if (options[item.name] && typeof ctor === 'function') {
          this.plugins[item.name] = new ctor(this)
        }
      })
  }

  private handleAutoBlur() {
    if (this.options.autoBlur) {
      this.on(this.eventTypes.beforeScrollStart, () => {
        let activeElement = document.activeElement as HTMLElement
        if (
          activeElement &&
          (activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA')
        ) {
          activeElement.blur()
        }
      })
    }
  }

  private eventBubbling() {
    bubbling(this.scroller.hooks, this, [
      'beforeScrollStart',
      'scrollStart',
      'scroll',
      'scrollEnd',
      'scrollCancel',
      'touchEnd',
      'flick'
    ])
  }

  private innerRefresh() {
    this.scroller.refresh()
    this.hooks.trigger(this.hooks.eventTypes.refresh)
    this.trigger(this.eventTypes.refresh)
  }

  proxy(propertiesConfig: PropertyConfig[]) {
    propertiesConfig.forEach(({ key, sourceKey }) => {
      propertiesProxy(this, sourceKey, key)
    })
  }
  refresh() {
    this.innerRefresh()
    this.scroller.resetPosition()
  }

  enable() {
    this.scroller.enable()
    this.hooks.trigger(this.hooks.eventTypes.enable)
    this.trigger(this.eventTypes.enable)
  }

  disable() {
    this.scroller.disable()
    this.hooks.trigger(this.hooks.eventTypes.disable)
    this.trigger(this.eventTypes.disable)
  }

  destroy() {
    this.hooks.trigger(this.hooks.eventTypes.destroy)
    this.trigger(this.eventTypes.destroy)
    this.scroller.destroy()
  }
  eventRegister(names: string[]) {
    this.registerType(names)
  }
}

export interface BScrollConstructor extends BScrollInstance {}

export interface CustomAPI {
  [key: string]: {}
}

type UnionToIntersection<U> = (U extends any
  ? (k: U) => void
  : never) extends ((k: infer I) => void)
  ? I
  : never

type ExtractAPI<O> = {
  [K in keyof O]: K extends string
    ? DefOptions[K] extends undefined
      ? CustomAPI[K]
      : never
    : never
}[keyof O]

export function createBScroll<O = {}>(
  el: ElementParam,
  options?: Options & O
): BScrollConstructor & UnionToIntersection<ExtractAPI<O>> {
  const bs = new BScrollConstructor(el, options)
  return (bs as unknown) as BScrollConstructor &
    UnionToIntersection<ExtractAPI<O>>
}

createBScroll.use = BScrollConstructor.use

type createBScroll = typeof createBScroll
export interface BScrollFactory extends createBScroll {
  new <O = {}>(el: ElementParam, options?: Options & O): BScrollConstructor &
    UnionToIntersection<ExtractAPI<O>>
}

export type BScroll<O = Options> = BScrollConstructor<O> &
  UnionToIntersection<ExtractAPI<O>>

export const BScroll = (createBScroll as unknown) as BScrollFactory
