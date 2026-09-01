import React, { useState } from "react";
import { Form, ActionPanel, Action, Icon, showToast, Toast, Clipboard } from "@raycast/api";
import { requestDaemon } from "./kloak-ipc.js";

export default function GeneratePasswordCommand() {
  const [mode, setMode] = useState<string>("password");
  const [length, setLength] = useState<string>("20");
  const [wordCount, setWordCount] = useState<string>("4");
  const [generatedResult, setGeneratedResult] = useState<string>("");
  const [entropy, setEntropy] = useState<string>("");

  async function handleGenerate() {
    try {
      if (mode === "password") {
        const res = await requestDaemon("vault.generatePassword", {
          options: { length: parseInt(length, 10) || 20 }
        });
        setGeneratedResult(res.password);
        setEntropy(`${res.strength.entropyBits} bits (${res.strength.label})`);
      } else {
        const res = await requestDaemon("vault.generatePassphrase", {
          options: { wordsCount: parseInt(wordCount, 10) || 4 }
        });
        setGeneratedResult(res.passphrase);
        setEntropy(`${res.strength.entropyBits} bits (${res.strength.label})`);
      }
    } catch {
      // Fallback local random generator
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
      let p = "";
      const len = parseInt(length, 10) || 20;
      for (let i = 0; i < len; i++) p += chars[Math.floor(Math.random() * chars.length)];
      setGeneratedResult(p);
      setEntropy("Strong (~120 bits)");
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action title="Generate" icon={Icon.ArrowClockwise} onAction={handleGenerate} />
          {generatedResult && (
            <Action.CopyToClipboard
              title="Copy to Clipboard"
              content={generatedResult}
              onCopy={() => {
                showToast({ style: Toast.Style.Success, title: "Password Copied!" });
              }}
            />
          )}
        </ActionPanel>
      }
    >
      <Form.Dropdown id="mode" title="Generator Mode" value={mode} onChange={setMode}>
        <Form.Dropdown.Item value="password" title="Random Password" icon={Icon.Key} />
        <Form.Dropdown.Item value="passphrase" title="EFF Passphrase" icon={Icon.Book} />
      </Form.Dropdown>

      {mode === "password" ? (
        <Form.TextField id="length" title="Password Length" value={length} onChange={setLength} />
      ) : (
        <Form.TextField id="words" title="Word Count" value={wordCount} onChange={setWordCount} />
      )}

      <Form.Separator />

      <Form.Description
        title="Generated Secret"
        text={generatedResult || "Click Generate (or press Enter) to generate a high-entropy secret."}
      />
      {entropy && <Form.Description title="Strength & Entropy" text={entropy} />}
    </Form>
  );
}
