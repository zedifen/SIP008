const pageUrl = 'https://gist.githubusercontent.com/zedifen/a18631c23094fb13ecaf3a1fb163c837/raw/ui.html'

export default {
  async fetch(request, env) {
    return await handleRequest(request).catch(
      (err) => new Response(err.stack, { status: 500 })
    )
  }
}

function ssToSIP008(link) {
  const u = link.substring(5); // skip 'ss://'
  let p = u.split('#');
  const name = decodeURIComponent(p[1]);
  let l = p[0].split('@');
  let c = atob(l[0]).split(':');
  const method = c[0];
  const password = c[1];
  let s = l[1].split(':');
  const address = s[0];
  const port = s[1];
  return {
    'id': name,
    'remarks': name,
    'method': method,
    'password': password,
    'server': address,
    'server_port': port,
  }
}

function makeSIP008Sub(shareLinks) {
  let sub = {
    'version': 1,
    'servers': [],
  };
  shareLinks.forEach((link) => {
    if (link.startsWith('ss:')) {
      sub['servers'].push(ssToSIP008(link));
    }
  })
  return sub;
}

function isValidHttpUrl(s) {
  let url;
  try {
    url = new URL(s);
  } catch (err) {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

async function handleRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const link = url.searchParams.get("link");

  if (pathname == '/') {
    if (link === null) {
      let ui;
      await fetch(pageUrl).then((r) => r.text()).then((t) => { ui = t; });
      return new Response(ui, {
        status: 200,
        headers: {
          "content-type": "text/html;charset=utf-8"
        }
      });
    } else {
      if (!isValidHttpUrl(link)) {
        return new Response("Link '" + link + "' is not valid.", { status: 400 })
      }
      let returnedContent;
      await fetch(link, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64)',
        }
      })
        .then((response) => response.text())
        .then((t) => {
          returnedContent = t;
        })
        .catch((err) => new Response(err.stack, { status: 500 }));
      let shareLinks;
      try {
        shareLinks = atob(returnedContent).split(/\r?\n/);
      } catch (err) {
        return new Response("Cannot parse content of the link.", { status: 400 });
      }
      return new Response(JSON.stringify(makeSIP008Sub(shareLinks)), {
        status: 200,
        headers: {
          "content-type": "application/json;charset=utf-8"
        }
      });
    }
  } else {
    return new Response('Path not found.', {
      status: 404,
    });
  }
}
