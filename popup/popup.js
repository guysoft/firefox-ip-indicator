const app = document.getElementById("app");
const toast = document.getElementById("toast");

const SVG_NS = "http://www.w3.org/2000/svg";

function globe() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("aria-hidden", "true");

  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("cx", "12");
  circle.setAttribute("cy", "12");
  circle.setAttribute("r", "9");

  const meridians = document.createElementNS(SVG_NS, "path");
  meridians.setAttribute("d", "M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18");

  svg.append(circle, meridians);
  return svg;
}

const SOURCE_NOTES = {
  connection: "Live connection for this tab",
  dns: "From a DNS lookup, not the live connection",
  literal: "The URL points straight at an IP address",
};

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  for (const child of children) node.append(child);
  return node;
}

function showToast(text) {
  toast.textContent = text;
  toast.hidden = false;
  setTimeout(() => {
    toast.hidden = true;
  }, 1400);
}

function hero(info) {
  const family = info.family;
  const label = family === "ipv6" ? "IPv6" : family === "ipv4" ? "IPv4" : "Unknown";
  const badge = el("div", {
    className: "hero__badge",
    textContent: family === "ipv6" ? "6" : family === "ipv4" ? "4" : "?",
  });

  const address = el("button", {
    className: "hero__ip",
    textContent: info.ip || "no address",
    disabled: !info.ip,
  });
  if (info.ip) {
    address.addEventListener("click", async () => {
      await navigator.clipboard.writeText(info.ip);
      showToast("Address copied");
    });
  }

  const section = el("section", { className: "hero" }, [
    badge,
    el("p", { className: "hero__label", textContent: `Served over ${label}` }),
    el("p", { className: "hero__source", textContent: SOURCE_NOTES[info.source] || "" }),
    address,
  ]);
  section.dataset.family = family;
  if (info.ip) {
    section.append(el("p", { className: "hero__hint", textContent: "Tap the address to copy" }));
  }
  return section;
}

function stackRow(family, name, addresses, currentIp) {
  const row = el("div", { className: "row" });
  row.dataset.family = family;
  row.dataset.supported = addresses.length ? "yes" : "no";

  const head = el("div", { className: "row__head" }, [
    el("span", { className: "dot" }),
    el("span", { className: "row__name", textContent: name }),
  ]);
  if (currentIp && addresses.includes(currentIp)) {
    head.append(el("span", { className: "chip", textContent: "in use" }));
  }
  head.append(
    el("span", {
      className: "row__count",
      textContent: addresses.length ? `${addresses.length} record${addresses.length > 1 ? "s" : ""}` : "none",
    })
  );
  row.append(head);

  if (addresses.length) {
    row.append(
      el(
        "ul",
        {},
        addresses.map((address) =>
          el("li", { textContent: address, className: address === currentIp ? "is-current" : "" })
        )
      )
    );
  } else {
    row.append(el("p", { className: "row__empty", textContent: `This domain has no ${name} record.` }));
  }
  return row;
}

function render(info) {
  app.textContent = "";

  if (info.error && !info.ip) {
    app.append(el("p", { className: "status", textContent: info.error }));
    return;
  }

  const site = el("p", { className: "site" }, [globe(), el("span", { textContent: info.host })]);
  app.append(site, hero(info));

  const dns = info.dns || { v4: [], v6: [] };
  if (info.source !== "literal") {
    app.append(
      el("div", { className: "stack" }, [
        stackRow("ipv6", "IPv6", dns.v6, info.ip),
        stackRow("ipv4", "IPv4", dns.v4, info.ip),
      ])
    );
  }

  const notes = [];
  if (dns.canonicalName && dns.canonicalName !== info.host) notes.push(`CNAME: ${dns.canonicalName}`);
  if (dns.isTRR) notes.push("Resolved over DNS-over-HTTPS");
  if (info.fromCache) notes.push("Page came from cache");
  if (dns.error) notes.push(`DNS lookup failed: ${dns.error}`);
  notes.push("This is the address of the site's server, not your own address.");
  app.append(el("p", { className: "notes", textContent: notes.join(" · ") }));
}

browser.runtime
  .sendMessage({ type: "getInfo" })
  .then(render)
  .catch((error) => {
    app.textContent = "";
    app.append(el("p", { className: "status", textContent: String(error.message || error) }));
  });
