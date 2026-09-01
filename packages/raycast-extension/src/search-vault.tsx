import React, { useState, useEffect } from "react";
import { List, ActionPanel, Action, Icon, showToast, Toast, Clipboard } from "@raycast/api";
import { requestDaemon, KloakItem } from "./kloak-ipc.js";

export default function SearchVaultCommand() {
  const [items, setItems] = useState<KloakItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchText, setSearchText] = useState<string>("");

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    setIsLoading(true);
    try {
      const res = await requestDaemon("vault.getItems");
      setItems(res || []);
    } catch (err: any) {
      showToast({
        style: Toast.Style.Failure,
        title: "Vault Locked or Unavailable",
        message: err.message
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function copyWithAutoClear(text: string, label: string) {
    await Clipboard.copy(text);
    showToast({
      style: Toast.Style.Success,
      title: `Copied ${label} to clipboard`,
      message: "Clipboard will auto-clear in 30 seconds"
    });

    // Auto-clear after 30 seconds
    setTimeout(async () => {
      const current = await Clipboard.readText();
      if (current === text) {
        await Clipboard.clear();
      }
    }, 30000);
  }

  const filtered = items.filter((item) => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      (item.username?.toLowerCase().includes(q) ?? false) ||
      item.urls.some((u) => u.toLowerCase().includes(q))
    );
  });

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search Kloak passwords, usernames, websites..."
      onSearchTextChange={setSearchText}
    >
      <List.Section title={`Vault Items (${filtered.length})`}>
        {filtered.map((item) => (
          <List.Item
            key={item.id}
            icon={item.type === "card" ? Icon.CreditCard : item.type === "secure_note" ? Icon.Document : Icon.Key}
            title={item.title}
            subtitle={item.username || item.urls[0] || ""}
            accessories={[
              { text: item.totpSecret ? "TOTP" : undefined, icon: item.totpSecret ? Icon.Clock : undefined },
              { icon: item.favorite ? Icon.Star : undefined }
            ]}
            actions={
              <ActionPanel>
                <ActionPanel.Section>
                  {item.password && (
                    <Action
                      title="Copy Password"
                      icon={Icon.Key}
                      onAction={() => copyWithAutoClear(item.password!, "Password")}
                    />
                  )}
                  {item.username && (
                    <Action
                      title="Copy Username"
                      icon={Icon.Person}
                      onAction={() => copyWithAutoClear(item.username!, "Username")}
                    />
                  )}
                  {item.totpSecret && (
                    <Action
                      title="Copy TOTP Code"
                      icon={Icon.Clock}
                      onAction={async () => {
                        try {
                          const res = await requestDaemon("vault.generateTotp", { secret: item.totpSecret });
                          if (res?.token) {
                            await copyWithAutoClear(res.token, "TOTP Code");
                          }
                        } catch (e: any) {
                          showToast({ style: Toast.Style.Failure, title: "Failed to generate TOTP", message: e.message });
                        }
                      }}
                    />
                  )}
                  {item.urls[0] && (
                    <Action.OpenInBrowser url={item.urls[0]} title="Open Website" />
                  )}
                </ActionPanel.Section>
                <ActionPanel.Section>
                  <Action
                    title="Reload Vault"
                    icon={Icon.ArrowClockwise}
                    shortcut={{ modifiers: ["cmd"], key: "r" }}
                    onAction={loadItems}
                  />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}
