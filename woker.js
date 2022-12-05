const page = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Convert V2RayN Sub to SIP008</title>
  <style>
    body {
      padding: 10px;
    }
  </style>
</head>
<body>
  <h1>Convert V2RayN Sub to SIP008</h1>
  <p>Input your subscription link: </p>
  <input 
    id="v2rayn-link"
    type="text"
    placeholder="Paste V2RayN subscription link here ..."
    spellcheck="false"
    size="96"
  />
  <br/>
  <p>Get converted subscription at: <a id="converted"></a></p>
  <script>
    const origin = (window.location.origin + '/') || 'https://example.org/';
    const userInput = document.getElementById('v2rayn-link');
    const outputLink = document.getElementById('converted');
    userInput.addEventListener('input', () => {
      converted = origin + '?link=' + encodeURIComponent(userInput.value);
      outputLink.setAttribute('href', converted);
      outputLink.innerHTML = converted;
    });
  </script>
</body>
</html>`

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

async function handleRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const link = url.searchParams.get("link");

  if (pathname == '/') {
    if (link === null || link === '') {
      return new Response(page, {
        status: 200,
        headers: {
          "content-type": "text/html;charset=utf-8"
        }
      });
    } else {
      let returnedContent = '123';
      await fetch(link, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64)',
        }
      })
        .then((response) => response.text())
        .then((t) => {
          returnedContent = t;
        })
        .catch((err) => new Response(err.stack, { status: 500 }))
      const shareLinks = atob(returnedContent).split(/\r?\n/);
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
