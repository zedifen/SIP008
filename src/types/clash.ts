type ClashNodeTypes =
  | 'ss'
  | 'vmess'
;

type ClashNodeConfigBase = {
  'name': string,
  'type': ClashNodeTypes,
  'server': string,
  'port': number,
  'cipher': string,
}

export type ClashSsNodeConfig = ClashNodeConfigBase & {
  'type': 'ss',
  'password': string,
  'plugin'?: string,
  'plugin-opts'?: {
    mode: string,
    tls: boolean,
    host: string,
    path: string,
  },
}

type ClashVmessNodeConfigBase = ClashNodeConfigBase & {
  'type': 'vmess',
  'uuid': string,
  'alterId': number,
  'cipher': string,
  'tls': boolean,
  'network': 'ws' | 'h2' | 'http',
}

export type ClashVMessWsNodeConfig = ClashVmessNodeConfigBase & {
  'network': 'ws',
  'ws-opts': {
    'path': string,
    'headers': {
      'Host': string,
    },
    'max-early-data': number,
    'early-data-header-name': string,
  },
}

export type ClashVMessH2NodeConfig = ClashVmessNodeConfigBase & {
  'network': 'h2',
  'h2-opts': {
    host: string[],
    path: string,
  },
}

export type ClashVMessHttpNodeConfig = ClashVmessNodeConfigBase & {
  'network': 'http',
  'http-opts': {
    method: 'GET',
    path: string[],
  }
}

export type ClashVmessNodeConfig =
  | ClashVMessWsNodeConfig
  | ClashVMessH2NodeConfig
  | ClashVMessHttpNodeConfig
;

export type ClashNodeConfig = ClashSsNodeConfig | ClashVmessNodeConfig;

export type ClashSub = {
  'port': number,
  'socks-port': number,
  'allow-lan': boolean,
  'mode': 'rule',
  'proxies': ClashNodeConfig[],
  'proxy-groups': {
    'name': string,
    'type': 'select' | 'relay',
    'proxies': string[],
  }[],
  'rules': string[],
}
