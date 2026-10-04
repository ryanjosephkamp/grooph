/* Inlined at the foot of each page (handoff 0060). The pages read the same without it: this only adds a Copy button to each code block. */
(function () {
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
