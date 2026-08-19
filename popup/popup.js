const app = document.getElementById("app");

const SOURCE_NOTES = {
  connection: "Address this tab is actually connected to.",
  dns: "Resolved by DNS (page loaded before the add-on, or served from cache).",
  literal: "The URL points straight at an IP address.",
};

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  for (const child of children) node.append(child);
  return node;
}

function addressList(title, addresses) {
  const items = addresses.length
    ? addresses.map((address) => el("li", { textContent: address }))
    : [el("li", { className: "empty", textContent: "none" })];
  return el("section", {}, [el("h2", { textContent: title }), el("ul", {}, items)]);
}

function render(info) {
  app.textContent = "";

  if (info.error && !info.ip) {
    app.append(el("p", { className: "status", textContent: info.error }));
    return;
  }

  const family = info.family === "unknown" ? "unknown" : info.family;
  const label = family === "ipv6" ? "IPv6" : family === "ipv4" ? "IPv4" : "?";

  app.append(
    el("p", { className: "host", textContent: info.host }),
    el("div", { className: "primary" }, [
      el("span", { className: "chip", textContent: label }),
      el("span", { className: "ip", textContent: info.ip || "unknown" }),
    ]),
    el("p", {
      className: "note",
      textContent: SOURCE_NOTES[info.source] || "",
    })
  );

  if (info.ip) {
    const copy = el("button", { className: "copy", textContent: "Copy address" });
    copy.addEventListener("click", async () => {
      await navigator.clipboard.writeText(info.ip);
      copy.textContent = "Copied";
    });
    app.append(copy);
  }

  const dns = info.dns || { v4: [], v6: [] };
  if (info.source !== "literal") {
    app.append(addressList("IPv6 (AAAA)", dns.v6), addressList("IPv4 (A)", dns.v4));
  }

  const extras = [];
  if (dns.canonicalName && dns.canonicalName !== info.host) {
    extras.push(`CNAME: ${dns.canonicalName}`);
  }
  if (dns.isTRR) extras.push("Resolved over DNS-over-HTTPS");
  if (info.fromCache) extras.push("Page was served from cache");
  if (dns.error) extras.push(`DNS lookup failed: ${dns.error}`);
  if (extras.length) {
    app.append(el("p", { className: "note", textContent: extras.join(" · ") }));
  }
}

browser.runtime
  .sendMessage({ type: "getInfo" })
  .then(render)
  .catch((error) => {
    app.textContent = "";
    app.append(el("p", { className: "status", textContent: String(error.message || error) }));
  });
