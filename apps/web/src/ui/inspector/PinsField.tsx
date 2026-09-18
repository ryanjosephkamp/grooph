import { useState } from "react";

import { KNOWN_TARGETS, type AgentNode, type Node } from "@grooph/core";

import { withField } from "../../doc/ops.js";
import { Field } from "../fields.js";

/** `model.pin`: a literal model name per harness, overriding the tier there. */
export function PinsField({ node, update }: { node: AgentNode; update: (fn: (n: Node) => Node) => void }) {
  const pins: Record<string, string> = node.model?.pin ?? {};
  const [harness, setHarness] = useState(KNOWN_TARGETS[0] ?? "claude-code");
  const [model, setModel] = useState("");
  const tier = node.model?.tier;

  const setPins = (next: Record<string, string>) =>
    update((n) => {
      const agent = n as AgentNode;
      if (!agent.model) return n;
      return { ...agent, model: withField(agent.model, "pin", Object.keys(next).length === 0 ? undefined : next) };
    });

  return (
    <Field label="Model pins" hint={tier ? "Overrides the tier for one harness." : "Choose a model tier first; a pin sits beside it."}>
      {(id) => (
        <div className="pins" id={id}>
          {Object.entries(pins).map(([h, m]) => (
            <div key={h} className="pin-row">
              <span className="mono">{h}</span>
              <span className="mono pin-model">{m}</span>
              <button
                type="button"
                className="btn btn-quiet"
                aria-label={`Remove pin for ${h}`}
                onClick={() => {
                  const { [h]: _gone, ...rest } = pins;
                  setPins(rest);
                }}
              >
                Remove
              </button>
            </div>
          ))}
          <div className="inline-add">
            <input
              className="input mono"
              aria-label="Pin harness"
              value={harness}
              autoCapitalize="off"
              onChange={(e) => setHarness(e.target.value)}
            />
            <input
              className="input mono"
              aria-label="Pinned model"
              placeholder="model name"
              value={model}
              autoCapitalize="off"
              onChange={(e) => setModel(e.target.value)}
            />
            <button
              type="button"
              className="btn"
              disabled={!tier || harness.trim() === "" || model.trim() === ""}
              onClick={() => {
                setPins({ ...pins, [harness.trim()]: model.trim() });
                setModel("");
              }}
            >
              Pin
            </button>
          </div>
        </div>
      )}
    </Field>
  );
}
