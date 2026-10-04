/* Inlined at the foot of each page (handoff 0060). The pages read the same without it: this adds a Copy button to each code block,
   and since handoff 0077 folds the header's links under a Menu button on a narrow screen, shows the theme switch, and opens the
   contents list where it stands beside the column. */
(function () {
  var root = document.documentElement;
  var header = document.querySelector(".site-header");

  /* The Menu button: the links fold under it below 861 px (chrome.css), once there is a script to unfold them. */
  var menu = header.querySelector(".site-menu-toggle");
  var nav = header.querySelector(".site-nav");
  var fold = function (open) {
    nav.classList.toggle("is-open", open);
    menu.setAttribute("aria-expanded", String(open));
  };
  menu.hidden = false;
  header.classList.add("has-menu");
  menu.addEventListener("click", function () {
    fold(menu.getAttribute("aria-expanded") !== "true");
  });
  nav.addEventListener("click", function () {
    fold(false);
  });
  header.addEventListener("keydown", function (event) {
    if (event.key === "Escape") fold(false);
  });

  /* The theme switch, a menu button: arrows move, Enter or Space chooses, Escape closes. The choice is kept in this browser,
     under the key the front page uses; the script in the head applies it before the first paint. */
  var theme = header.querySelector(".site-theme");
  var toggle = theme.querySelector(".site-theme-toggle");
  var list = theme.querySelector(".site-theme-list");
  var items = Array.prototype.slice.call(list.querySelectorAll("[role=menuitemradio]"));
  var bar = document.querySelector('meta[name="theme-color"]');
  var show = function (id) {
    var chosen = items[0];
    items.forEach(function (item) {
      if (item.getAttribute("data-theme-id") === id) chosen = item;
    });
    if (chosen === items[0]) root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", chosen.getAttribute("data-theme-id"));
    items.forEach(function (item) {
      item.setAttribute("aria-checked", String(item === chosen));
    });
    toggle.setAttribute("aria-label", "Theme: " + chosen.textContent.trim());
    if (bar) bar.content = getComputedStyle(header).backgroundColor;
    return chosen;
  };
  var close = function (focus) {
    if (list.hidden) return;
    list.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    if (focus) toggle.focus();
  };
  var open = function () {
    list.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    (list.querySelector('[aria-checked="true"]') || items[0]).focus();
  };
  theme.hidden = false;
  show(root.getAttribute("data-theme"));
  toggle.addEventListener("click", function () {
    if (list.hidden) open();
    else close(false);
  });
  toggle.addEventListener("keydown", function (event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      open();
    }
  });
  list.addEventListener("click", function (event) {
    var item = event.target.closest("[role=menuitemradio]");
    if (!item) return;
    var id = show(item.getAttribute("data-theme-id")).getAttribute("data-theme-id");
    try {
      localStorage.setItem("groophTheme", id);
    } catch (e) {}
    /* A ?theme= in the address would bring the old choice back on the next load. */
    var url = new URL(location.href);
    if (url.searchParams.has("theme")) {
      url.searchParams.delete("theme");
      history.replaceState(history.state, "", url);
    }
    close(true);
  });
  list.addEventListener("keydown", function (event) {
    var at = items.indexOf(document.activeElement);
    var to = event.key === "ArrowDown" ? (at + 1) % items.length : event.key === "ArrowUp" ? (at - 1 + items.length) % items.length : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : -1;
    if (to >= 0) {
      event.preventDefault();
      items[to].focus();
    } else if (event.key === "Escape") {
      event.stopPropagation();
      close(true);
    } else if (event.key === "Tab") close(false);
  });
  document.addEventListener("click", function (event) {
    if (!event.target.closest(".site-theme")) close(false);
  });

  /* The contents list is open where it stands beside the column, and folded above it on a narrow screen. */
  var toc = document.querySelector("details.toc");
  if (toc && matchMedia("(min-width: 980px)").matches) toc.open = true;

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var box = document.createElement("textarea");
      box.value = text;
      box.setAttribute("readonly", "");
      box.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(box);
      box.select();
      var ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (e) {}
      document.body.removeChild(box);
      if (ok) resolve();
      else reject(new Error("copy failed"));
    });
  }
  var blocks = document.querySelectorAll(".doc .code");
  for (var i = 0; i < blocks.length; i += 1) {
    (function (block) {
      var code = block.querySelector("code");
      var bar = document.createElement("div");
      bar.className = "code-bar";
      var label = document.createElement("span");
      label.textContent = block.getAttribute("data-lang") || "";
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = "Copy";
      button.setAttribute("aria-label", "Copy this code");
      var said = document.createElement("span");
      said.setAttribute("role", "status");
      said.className = "sr-only";
      said.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)";
      var timer = 0;
      button.addEventListener("click", function () {
        var done = function (text) {
          button.textContent = text;
          said.textContent = text;
          clearTimeout(timer);
          timer = setTimeout(function () {
            button.textContent = "Copy";
            said.textContent = "";
          }, 1800);
        };
        copy(code.textContent.replace(/\n$/, "")).then(
          function () {
            done("Copied");
          },
          function () {
            done("Select and copy");
          },
        );
      });
      bar.appendChild(label);
      bar.appendChild(button);
      bar.appendChild(said);
      block.insertBefore(bar, block.firstChild);
    })(blocks[i]);
  }
})();
