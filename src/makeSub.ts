import { sip008toClash } from "./fromSIP008.ts";
import { ssToSIP008, vmessLinkToClash } from "./fromShareLink.ts";
import { ClashNodeConfig, ClashSub } from "./types/clash.ts";
import { SIP008Sub, ShadowsocksAndroidRouteOption, routeOptions } from "./types/shadowsocks.ts";

export function makeSIP008Sub(shareLinks: {[index: number]: string}, route: string | null) {
  const sub: SIP008Sub = {
    'version': 1,
    'servers': [],
    'clash': [],
  };

  const r: ShadowsocksAndroidRouteOption = routeOptions.includes((route as ShadowsocksAndroidRouteOption)) ? (route as ShadowsocksAndroidRouteOption) : 'bypass-lan-china';
  Object.entries(shareLinks).forEach(([_i, link]) => {
    if (link.startsWith('ss:')) {
      sub['servers'].push(ssToSIP008(link, r));
    } else if (link.startsWith('vmess:')) {
      sub['clash']!.push(vmessLinkToClash(link));
    }
  });
  return sub;
}


export function parseLinkToClashObject(link: string) {
  if (link.startsWith('ss:')) {
    return sip008toClash(ssToSIP008(link));
  } else if (link.startsWith('vmess:')) {
    return vmessLinkToClash(link);
  } else { return null; }
}

export async function makeClashSub(clashObjects: {[index: string]: ClashNodeConfig}, chains: string[][], template: ClashSub) {
  const sub = { ...template };
  const s = new Set<string>();
  const l: string[] = [];
  if (chains.length > 0) {
    for (const c of chains) {
      c.slice(0, c.length-1).forEach(i => s.add(i));
      sub['proxy-groups'].push({
        'name': 'Relay ' + c[c.length-1],
        'type': 'relay',
        'proxies': c,
      });
    }
    sub['proxy-groups'].push({  // forward group
      'name': 'Forward',
      'type': 'select',
      'proxies': [...s],
    });
  }
  Object.entries(clashObjects).forEach(([k, v]) => {
    sub['proxies'].push(v);
    if (!s.has(k)) { l.push(k); }
  });
  const DEFAULT_GROUP_NAME = 'Proxy';
  const defaultGroup = {  // default group
    'name': DEFAULT_GROUP_NAME,
    'type': ('select' as const),
    'proxies': l,
  };
  sub['proxy-groups'].push(defaultGroup);
  sub['proxy-groups'].forEach(group => {
    group['proxies'] = group['proxies'].map((i: string) => clashObjects[i]['name']);
  });
  sub['proxy-groups'].forEach(group => {
    if (group['type'] === 'relay') defaultGroup['proxies'].push(group['name']);
  });
  sub['proxy-groups'].push({
    'name': 'CHN',
    'type': 'select',
    'proxies': ['DIRECT', DEFAULT_GROUP_NAME],
  });
  sub['proxy-groups'].push({
    'name': 'Apple-CHN',
    'type': 'select',
    'proxies': ['DIRECT', DEFAULT_GROUP_NAME],
  });
  sub['proxy-groups'].push({
    'name': 'Google-CHN',
    'type': 'select',
    'proxies': ['DIRECT', DEFAULT_GROUP_NAME],
  });
  sub['proxy-groups'].push({
    'name': 'Telegram',
    'type': 'select',
    'proxies': [DEFAULT_GROUP_NAME, 'DIRECT'],
  });
  sub['proxy-groups'].push({
    'name': 'Final',
    'type': 'select',
    'proxies': [DEFAULT_GROUP_NAME, 'DIRECT'],
  });
  const rules = [];
  await fetch('https://core.telegram.org/resources/cidr.txt')
    .then(r => r.text())
    .then(t => {
      for (const ipCIDR of t.split(/\r?\n/)) {
        if (ipCIDR.indexOf('.') != -1) {
          rules.push('IP-CIDR,' + ipCIDR + ',Telegram,no-resolve');
        } else if (ipCIDR.indexOf(':') != -1) {
          rules.push('IP-CIDR6,' + ipCIDR + ',Telegram,no-resolve');
        }
      }
    });
  const domainListsUrlPrefix = 'https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/';
  const domainLists = {
    'CHN': 'accelerated-domains.china.conf',
    'Apple-CHN': 'apple.china.conf',
    'Google-CHN': 'google.china.conf',
  };
  for (const [i, v] of Object.entries(domainLists)) {
    await fetch(domainListsUrlPrefix + v)
      .then(r => r.text())
      .then(t => {
        for (const m of t.split(/\r?\n/)) {
          if (m.startsWith('server')) {
            const domain = m.slice(m.indexOf('/') + 1, m.lastIndexOf('/'))
            rules.push('DOMAIN-SUFFIX,' + domain + ',' + i);
          }
        }
      });
  }
  rules.push('MATCH,Final');
  sub['rules'] = rules;
  return sub;
}

