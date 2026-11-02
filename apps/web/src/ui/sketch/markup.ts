/**
 * The Sketch view's page (`studio.ts`): mermaidify's Draw page, its tools, its drawing, and the line of what was read,
 * with the graph below where mermaidify has its diagram. Its classes start `sk-`, so no rule of the app's reaches
 * them, and its ids start `sk-`; one Sketch view is on the page at a time.
 */
export const MARKUP = `
<section class="sk-draw" aria-label="Drawing">
  <div class="sk-bar" role="toolbar" aria-label="Drawing tools">
    <div class="sk-tools-row">
      <div class="sk-tools">
        <div class="sk-seg" role="radiogroup" aria-label="Tool">
          <button type="button" role="radio" aria-checked="true" data-tool="draw" title="Pen (D)">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 16.5 4.4 13 13 4.4a1.8 1.8 0 0 1 2.6 2.6L7 15.6Z" /><path d="m11.6 5.8 2.6 2.6" /></svg><span>Pen</span>
          </button>
          <button type="button" role="radio" aria-checked="false" data-tool="erase" data-options="eraser" title="Eraser (E). Tap it again to erase whole strokes or only what it passes over" aria-describedby="sk-tool-kinds">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8.2 16.5h8.3M3.9 12.2l7.5-7.5a1.6 1.6 0 0 1 2.3 0l2.6 2.6a1.6 1.6 0 0 1 0 2.3l-6.3 6.3a2 2 0 0 1-1.4.6H6.8a2 2 0 0 1-1.4-.6l-1.5-1.5a1.6 1.6 0 0 1 0-2.2Z" /><path d="m7.3 8.8 4.8 4.8" /></svg><span>Eraser</span>
          </button>
          <button type="button" role="radio" aria-checked="false" data-tool="select" data-options="select" title="Select (V): press a stroke to move it, or drag a box around strokes. Tap it again for a lasso" aria-describedby="sk-tool-kinds">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 3.2 15.3 9l-4.7 1.3-2.2 4.4Z" /><path d="m10.6 10.3 3.6 4.9" /></svg><span>Select</span>
          </button>
          <button type="button" role="radio" aria-checked="false" data-tool="hand" title="Hand (H): drag to move around the drawing. Space and a drag does the same">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 10.5V5.2a1.2 1.2 0 0 1 2.4 0v4.3M9.4 9.5V4a1.2 1.2 0 0 1 2.4 0v5.5M11.8 9.5V5a1.2 1.2 0 0 1 2.4 0v6.2c0 3.2-2 5.3-4.8 5.3-2 0-3.2-.9-4.3-2.6L3.5 11.2a1.2 1.2 0 0 1 2-1.3L7 12" /></svg><span>Hand</span>
          </button>
        </div>
        <ul class="sk-menu sk-tool-menu" id="sk-tool-menu" role="menu" hidden></ul>
        <span class="sr-only" id="sk-tool-kinds">Once chosen, press again for its kinds.</span>
      </div>
      <span class="sk-rule" aria-hidden="true"></span>
      <fieldset class="sk-inks" id="sk-inks">
        <legend class="sr-only">Ink</legend>
      </fieldset>
    </div>
    <div class="sk-tools-row">
      <button class="sk-icon" type="button" id="sk-undo" aria-label="Undo" title="Undo (Ctrl+Z)" disabled>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 5 4 8.5 7.5 12" /><path d="M4.5 8.5h7.2a4.3 4.3 0 0 1 0 8.6H9" /></svg>
      </button>
      <button class="sk-icon" type="button" id="sk-redo" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 5 16 8.5 12.5 12" /><path d="M15.5 8.5H8.3a4.3 4.3 0 0 0 0 8.6H11" /></svg>
      </button>
      <button class="sk-icon" type="button" id="sk-clear" aria-label="Clear the drawing" title="Clear the drawing (Undo brings it back)" disabled>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.8 5.8h12.4M8 5.8V4.2h4v1.6M5.4 5.8l.8 10a1.4 1.4 0 0 0 1.4 1.3h4.8a1.4 1.4 0 0 0 1.4-1.3l.8-10M8.6 9v4.8M11.4 9v4.8" /></svg>
      </button>
      <span class="sk-rule" aria-hidden="true"></span>
      <div class="sk-more sk-add">
        <button class="sk-icon" type="button" id="sk-add" aria-haspopup="menu" aria-expanded="false" aria-controls="sk-add-list" aria-label="Add a step, an arrow, or a template" title="Add a step, an arrow, or a template">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4.2v11.6M4.2 10h11.6" /></svg>
        </button>
        <div class="sk-menu sk-add-menu" id="sk-add-list" role="menu" aria-label="Add" hidden></div>
      </div>
      <div class="sk-more">
        <button class="sk-icon" type="button" id="sk-more" aria-haspopup="menu" aria-expanded="false" aria-controls="sk-more-list" aria-label="More" title="More">
          <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="4.5" cy="10" r="1.4" /><circle cx="10" cy="10" r="1.4" /><circle cx="15.5" cy="10" r="1.4" /></svg>
        </button>
        <ul class="sk-menu" id="sk-more-list" role="menu" aria-label="More" hidden>
          <li role="none"><button type="button" role="menuitem" data-act="example">Load the example</button></li>
          <li role="none"><button type="button" role="menuitem" data-act="redraw">Draw the graph again</button></li>
          <li role="none"><button type="button" role="menuitem" data-act="fit">Fit the drawing to the screen</button></li>
          <li role="none"><button type="button" role="menuitemcheckbox" aria-checked="true" data-act="snap">Snap shapes and arrows when you hold</button></li>
          <li role="none"><button type="button" role="menuitemcheckbox" aria-checked="true" data-act="names">Show names on the drawing</button></li>
          <li role="none"><button type="button" role="menuitemcheckbox" aria-checked="true" data-act="outlines">Show what it read</button></li>
          <li role="separator"></li>
          <li role="none"><button type="button" role="menuitem" data-act="save-drawing">Save the drawing (.json)</button></li>
          <li role="none"><button type="button" role="menuitem" data-act="open-drawing">Open a drawing…</button></li>
        </ul>
        <input type="file" id="sk-open-file" accept=".json,application/json" hidden />
      </div>
      <span class="sk-spacer"></span>
      <button class="sk-go" type="button" id="sk-go" data-stale="false" title="Make it a graph (Ctrl+Enter)">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10.2c1.6-3.4 3.4-3.4 5 0s3.4 3.4 5 0" /><path d="m13.5 6.5 3.5 3.7-3.5 3.7" /></svg>Make it a graph
      </button>
    </div>
  </div>
  <div class="sk-pad" id="sk-pad-wrap">
    <canvas id="sk-pad" role="img" aria-label="Drawing area. Draw the steps and the arrows that join them, then press Make it a graph."></canvas>
    <div class="sk-hint" id="sk-hint">
      <p><strong>Draw a graph here.</strong> Boxes, ovals, diamonds, and the other shapes, joined by arrows, in any order. Hold still at the end of a shape to tidy it, then press Make it a graph. The plus adds steps, arrows, and templates.</p>
      <button class="btn" type="button" id="sk-hint-example">Load the example</button>
    </div>
    <p class="sk-chip" id="sk-pen-chip" hidden>
      <span>Pen draws; fingers move the drawing.</span>
      <button type="button" id="sk-fingers-draw">Let fingers draw</button>
    </p>
    <div class="sk-corner">
      <button class="sk-zoom" type="button" id="sk-zoom" title="Fit the drawing to the screen" hidden></button>
      <button class="sk-full" type="button" id="sk-full" aria-pressed="false" aria-label="Full screen" title="Full screen (F)">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path class="sk-enter" d="M3.5 7.5v-4h4M12.5 3.5h4v4M16.5 12.5v4h-4M7.5 16.5h-4v-4" /><path class="sk-leave" d="M7.5 3.5v4h-4M16.5 7.5h-4v-4M12.5 16.5v-4h4M3.5 12.5h4v4" /></svg>
      </button>
    </div>
    <div class="sk-sel-bar" id="sk-sel-bar" role="toolbar" aria-label="Chosen strokes" hidden>
      <button type="button" data-sel="cut">Cut</button>
      <button type="button" data-sel="copy">Copy</button>
      <button type="button" data-sel="paste">Paste</button>
      <button type="button" data-sel="duplicate">Duplicate</button>
      <button type="button" data-sel="group">Group</button>
      <button type="button" data-sel="snap" title="Make the chosen shapes and arrows clean">Snap</button>
      <button type="button" data-sel="delete">Delete</button>
    </div>
    <form class="sk-name-edit" id="sk-name-edit" hidden>
      <label class="sr-only" for="sk-name-input" id="sk-name-label">Name</label>
      <input id="sk-name-input" type="text" autocomplete="off" enterkeyhint="done" maxlength="120" data-own-undo />
    </form>
  </div>
  <div class="sk-read-row">
    <p class="sk-read" id="sk-read" aria-live="polite">Nothing read yet.</p>
    <label class="sk-check"><input type="checkbox" id="sk-show-read" checked /> Show what it read</label>
  </div>
</section>

<section class="sk-result" id="sk-result" aria-label="The graph">
  <a class="sk-back" href="#sk-pad-wrap" id="sk-back">Back to the drawing</a>
  <div class="sk-panel">
    <div class="sk-panel-head">
      <h2>Graph</h2>
      <span id="sk-graph-hint">Tap a step to open it</span>
    </div>
    <div class="sk-diagram" id="sk-diagram"><p class="sk-empty">The graph appears here after Make it a graph.</p></div>
    <ul class="sk-guesses" id="sk-guesses" aria-label="What was guessed" hidden></ul>
    <div class="sk-row">
      <button class="btn" type="button" id="sk-undo-make" hidden>Undo Make it a graph</button>
      <button class="btn" type="button" id="sk-save-svg" disabled>Save SVG</button>
      <button class="btn" type="button" id="sk-save-png" disabled>Save PNG</button>
      <button class="btn" type="button" id="sk-export" title="Share a link, embed it, or download the package">Export…</button>
      <span class="sk-status" id="sk-save-status" role="status"></span>
    </div>
  </div>
  <div class="sk-panel">
    <div class="sk-panel-head">
      <h2>Names</h2>
      <span id="sk-names-note">Each step's and line's name, and what each shape makes</span>
    </div>
    <div class="sk-names" id="sk-names"><p class="sk-status">Shapes appear here after Make it a graph.</p></div>
    <p class="sk-note">Name a line <strong>pass</strong> or <strong>fail</strong> and it is followed only on that result; <strong>approval</strong> asks a person first.</p>
  </div>
  <div class="sk-panel">
    <div class="sk-panel-head">
      <h2><label for="sk-code">Mermaid code</label></h2>
      <span>The graph as Mermaid, as grooph writes it</span>
    </div>
    <textarea class="sk-code" id="sk-code" readonly spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" rows="12"></textarea>
    <div class="sk-row">
      <button class="btn" type="button" id="sk-copy">Copy code</button>
      <button class="btn" type="button" id="sk-save-mmd">Save .mmd</button>
      <span class="sk-status" id="sk-copy-status" role="status"></span>
    </div>
  </div>
</section>`;
