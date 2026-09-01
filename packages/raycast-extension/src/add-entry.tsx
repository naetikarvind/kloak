import React, { useState } from "react";
import { Form, ActionPanel, Action, Icon, showToast, Toast, useNavigation } from "@raycast/api";
import { requestDaemon } from "./kloak-ipc.js";

function generateSecurePassword(length = 20): string {
  const pool = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let res = "";
  for (let i = 0; i < length; i++) {
    res += pool.charAt(Math.floor(Math.random() * pool.length));
  }
  return res;
}

export default function AddEntryCommand() {
  const { pop } = useNavigation();

  // General fields
  const [type, setType] = useState<string>("login");
  const [title, setTitle] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Login fields
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [url, setUrl] = useState<string>("");
  const [totp, setTotp] = useState<string>("");

  // Payment Card fields
  const [cardholderName, setCardholderName] = useState<string>("");
  const [cardNumber, setCardNumber] = useState<string>("");
  const [cardBrand, setCardBrand] = useState<string>("visa");
  const [expMonth, setExpMonth] = useState<string>("");
  const [expYear, setExpYear] = useState<string>("");
  const [cvv, setCvv] = useState<string>("");

  // Identity fields
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [identityEmail, setIdentityEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [address1, setAddress1] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [state, setState] = useState<string>("");
  const [zip, setZip] = useState<string>("");
  const [country, setCountry] = useState<string>("");
  const [passportNumber, setPassportNumber] = useState<string>("");
  const [ssn, setSsn] = useState<string>("");

  // Alias fields
  const [aliasEmail, setAliasEmail] = useState<string>("");
  const [forwardTo, setForwardTo] = useState<string>("");

  async function handleSubmit() {
    if (!title.trim() && !username.trim() && !url.trim() && !cardholderName.trim() && !aliasEmail.trim()) {
      showToast({ style: Toast.Style.Failure, title: "Title or identification required" });
      return;
    }

    try {
      const itemPayload: any = {
        type,
        title: title.trim() || (type === "card" ? "Payment Card" : type === "identity" ? "Identity Profile" : "Untitled"),
        notes: notes.trim() || undefined,
        tags: []
      };

      if (type === "login") {
        itemPayload.username = username.trim() || undefined;
        itemPayload.password = password || undefined;
        itemPayload.urls = url.trim() ? [url.trim()] : [];
        itemPayload.totpSecret = totp.trim().replace(/\s+/g, "") || undefined;
      } else if (type === "secure_note") {
        // Only title and notes
      } else if (type === "card") {
        itemPayload.card = {
          cardholderName: cardholderName.trim() || undefined,
          number: cardNumber.trim().replace(/\s+/g, "") || undefined,
          brand: cardBrand,
          expMonth: expMonth.trim() || undefined,
          expYear: expYear.trim() || undefined,
          cvv: cvv.trim() || undefined
        };
      } else if (type === "identity") {
        itemPayload.identity = {
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          email: identityEmail.trim() || undefined,
          phone: phone.trim() || undefined,
          address1: address1.trim() || undefined,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          zip: zip.trim() || undefined,
          country: country.trim() || undefined,
          passportNumber: passportNumber.trim() || undefined,
          ssn: ssn.trim() || undefined
        };
      } else if (type === "alias") {
        itemPayload.username = aliasEmail.trim() || undefined;
        if (forwardTo.trim()) {
          itemPayload.notes = notes.trim()
            ? `Forward to: ${forwardTo.trim()}\n\n${notes.trim()}`
            : `Forward to: ${forwardTo.trim()}`;
        }
      }

      await requestDaemon("vault.addItem", { item: itemPayload });
      showToast({ style: Toast.Style.Success, title: `Saved "${itemPayload.title}" to Kloak Vault` });
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
          {type === "login" && (
            <Action
              title="Generate Strong Password"
              icon={Icon.Dice}
              shortcut={{ modifiers: ["cmd"], key: "g" }}
              onAction={() => {
                const generated = generateSecurePassword(20);
                setPassword(generated);
                showToast({ style: Toast.Style.Success, title: "Generated 20-character password" });
              }}
            />
          )}
        </ActionPanel>
      }
    >
      <Form.Dropdown id="type" title="Type" value={type} onChange={setType}>
        <Form.Dropdown.Item value="login" title="Login" icon={Icon.Key} />
        <Form.Dropdown.Item value="secure_note" title="Secure Note" icon={Icon.Document} />
        <Form.Dropdown.Item value="card" title="Payment Card" icon={Icon.CreditCard} />
        <Form.Dropdown.Item value="identity" title="Identity" icon={Icon.Person} />
        <Form.Dropdown.Item value="alias" title="Email Alias" icon={Icon.Envelope} />
      </Form.Dropdown>

      <Form.TextField
        id="title"
        title="Title"
        placeholder={
          type === "login"
            ? "e.g. GitHub, Google, Netflix"
            : type === "card"
            ? "e.g. Personal Visa, Apple Card"
            : type === "identity"
            ? "e.g. Personal Profile, Work ID"
            : type === "alias"
            ? "e.g. Shopping Alias, Newsletters"
            : "e.g. Recovery Codes, Wi-Fi"
        }
        value={title}
        onChange={setTitle}
      />

      {type === "login" && (
        <>
          <Form.TextField id="username" title="Username / Email" placeholder="user@example.com" value={username} onChange={setUsername} />
          <Form.PasswordField id="password" title="Password" placeholder="••••••••••••" value={password} onChange={setPassword} />
          <Form.TextField id="url" title="Website URL" placeholder="https://example.com" value={url} onChange={setUrl} />
          <Form.TextField id="totp" title="2FA Secret (TOTP)" placeholder="JBSWY3DPEHPK3PXP (Base32)" value={totp} onChange={setTotp} />
        </>
      )}

      {type === "card" && (
        <>
          <Form.TextField id="cardholderName" title="Cardholder Name" placeholder="John Doe" value={cardholderName} onChange={setCardholderName} />
          <Form.TextField id="cardNumber" title="Card Number" placeholder="4532 •••• •••• 8890" value={cardNumber} onChange={setCardNumber} />
          <Form.Dropdown id="cardBrand" title="Card Brand" value={cardBrand} onChange={setCardBrand}>
            <Form.Dropdown.Item value="visa" title="Visa" icon={Icon.CreditCard} />
            <Form.Dropdown.Item value="mastercard" title="Mastercard" icon={Icon.CreditCard} />
            <Form.Dropdown.Item value="amex" title="American Express" icon={Icon.CreditCard} />
            <Form.Dropdown.Item value="discover" title="Discover" icon={Icon.CreditCard} />
            <Form.Dropdown.Item value="other" title="Other" icon={Icon.CreditCard} />
          </Form.Dropdown>
          <Form.TextField id="expMonth" title="Exp Month" placeholder="MM (e.g. 09)" value={expMonth} onChange={setExpMonth} />
          <Form.TextField id="expYear" title="Exp Year" placeholder="YYYY (e.g. 2028)" value={expYear} onChange={setExpYear} />
          <Form.PasswordField id="cvv" title="Security Code (CVV)" placeholder="123" value={cvv} onChange={setCvv} />
        </>
      )}

      {type === "identity" && (
        <>
          <Form.TextField id="firstName" title="First Name" placeholder="John" value={firstName} onChange={setFirstName} />
          <Form.TextField id="lastName" title="Last Name" placeholder="Doe" value={lastName} onChange={setLastName} />
          <Form.TextField id="identityEmail" title="Email" placeholder="john.doe@example.com" value={identityEmail} onChange={setIdentityEmail} />
          <Form.TextField id="phone" title="Phone Number" placeholder="+1 (555) 019-2834" value={phone} onChange={setPhone} />
          <Form.TextField id="address1" title="Address" placeholder="123 Main St, Apt 4B" value={address1} onChange={setAddress1} />
          <Form.TextField id="city" title="City" placeholder="San Francisco" value={city} onChange={setCity} />
          <Form.TextField id="state" title="State / Province" placeholder="CA" value={state} onChange={setState} />
          <Form.TextField id="zip" title="ZIP / Postal Code" placeholder="94105" value={zip} onChange={setZip} />
          <Form.TextField id="country" title="Country" placeholder="United States" value={country} onChange={setCountry} />
          <Form.TextField id="passportNumber" title="Passport Number" placeholder="Optional" value={passportNumber} onChange={setPassportNumber} />
          <Form.PasswordField id="ssn" title="SSN / ID Number" placeholder="Optional" value={ssn} onChange={setSsn} />
        </>
      )}

      {type === "alias" && (
        <>
          <Form.TextField id="aliasEmail" title="Alias Email" placeholder="alias_xyz123@duck.com" value={aliasEmail} onChange={setAliasEmail} />
          <Form.TextField id="forwardTo" title="Forward To" placeholder="real.address@example.com" value={forwardTo} onChange={setForwardTo} />
        </>
      )}

      <Form.TextArea id="notes" title="Notes" placeholder="Additional notes or security info..." value={notes} onChange={setNotes} />
    </Form>
  );
}

