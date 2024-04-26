import { ClashNodeConfig } from "./clash.ts";

export type ShadowsocksAndroidRouteOption =
  | 'all'
  | 'bypass-lan'
  | 'bypass-china'
  | 'bypass-lan-china'
  | 'gfwlist'
  | 'china-list'
  | 'custom-rules'
;

export const routeOptions: ShadowsocksAndroidRouteOption[] = [  // Shadowsocks Android feature
  'all',
  'bypass-lan',
  'bypass-china',
  'bypass-lan-china',
  'gfwlist',
  'china-list',
  'custom-rules'
];

export type ShadowsocksMethod = string;

export type SIP008Node = {
  id: string,
  remarks: string,
  server: string,
  server_port: number,
  password: string,
  method: ShadowsocksMethod,
  route?: ShadowsocksAndroidRouteOption,  // Shadowsocks Android feature
  remote_dns?: string,  // Shadowsocks Android feature
  plugin?: string,
  plugin_opts?: string
}

// export type SIP008NodeWithPlugin = SIP008Node & {}

export type SIP008Sub = {
  'version': 1,
  'servers': SIP008Node[],
  'clash'?: ClashNodeConfig[],
}
