import React, { useState } from "react";
import { Form, ActionPanel, Action, Icon, showToast, Toast, useNavigation } from "@raycast/api";
import { requestDaemon } from "./kloak-ipc.js";

export default function AddEntryCommand() {
  const { pop } = useNavigation();
  const [type, setType] = useState<string>("login");
  const [title, setTitle] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [url, setUrl] = useState<string>("");
  const [totp, setTotp] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  async function handleSubmit() {
    if (!title && !username && !url) {
      showToast({ style: Toast.Style.Failure, title: "Title or username required" });
      return;
    }

    try {
      await requestDaemon("vault.addItem", {
        item: {
          type,
          title: title || "Untitled",
          username: username || undefined,
          password: password || undefined,
          urls: url ? [url] : [],
          totpSecret: totp || undefined,
          notes: notes || undefined
        }
      });
      showToast({ style: Toast.Style.Success, title: `Saved "${title}" to Kloak Vault` });
      pop();
    } catch (err: any) {
      showToast({ style: Toast.Style.Failure, title: "Failed to save item", message: err.message });
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save to Vault" icon={Icon.Check} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Dropdown id="type" title="Type" value={type} onChange={setType}>
        <Form.Dropdown.Item value="login" title="Login" icon={Icon.Key} />
        <Form.Dropdown.Item value="secure_note" title="Secure Note" icon={Icon.Document} />
        <Form.Dropdown.Item value="card" title="Payment Card" icon={Icon.CreditCard} />
        <Form.Dropdown.Item value="identity" title="Identity" icon={Icon.Person} />
      </Form.Dropdown>

      <Form.TextField id="title" title="Title" placeholder="e.g. GitHub, ProtonMail" value={title} onChange={setTitle} />
      <Form.TextField id="username" title="Username / Email" value={username} onChange={setUsername} />
      <Form.PasswordField id="password" title="Password" value={password} onChange={setPassword} />
      <Form.TextField id="url" title="Website URL" placeholder="https://..." value={url} onChange={setUrl} />
      <Form.TextField id="totp" title="TOTP Secret (Base32)" placeholder="JBSWY3DPEHPK3PXP" value={totp} onChange={setTotp} />
      <Form.TextArea id="notes" title="Notes" value={notes} onChange={setNotes} />
    </Form>
  );
}
