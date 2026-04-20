import React, { useEffect, useState } from "react";
import * as openpgp from "openpgp";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "./ui/item";
import { useLocation, useParams } from "react-router-dom";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "./ui/empty";

export const SecurePostViewer: React.FC = () => {
  const [raw, setRaw] = useState<string>("");
  const [markdown, setMarkdown] = useState<string>("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [verified, setVerified] = useState(false);
  const [keyId, setKeyId] = useState<string | null>(null);
  const [created, setCreated] = useState<Date | null>(null);
  const [user, setUser] = useState<string[] | null>(null);

  const location = useLocation();

  const { cid } = useParams();

  const domain = "blockflow.co.uk";

  const [error, setError] = useState<string | null>(null);

  // extract password from URL (?pw=...)
  function getPasswordFromUrl(): string | null {
    const params = new URLSearchParams(location.search);
    return params.get("pw");
  }

  async function getFingerprint(domain: string) {
    const res = await fetch(
      `https://dns.google/resolve?name=${domain}&type=TXT`,
    );

    const data = await res.json();

    const records = data.Answer || [];

    for (const r of records) {
      // TXT records come quoted like: "openpgp4fpr=ABCD..."
      const txt = r.data.replace(/^"|"$/g, "");

      if (txt.startsWith("openpgp4fpr=")) {
        return txt.split("=")[1];
      }
    }

    return null;
  }

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`https://ipfs.io/ipfs/${cid}`);
        const text = await res.text();

        setRaw(text);

        const pw = getPasswordFromUrl();

        if (text.includes("BEGIN PGP MESSAGE")) {
          if (pw) {
            await decrypt(text, pw);
          } else {
            setNeedsPassword(true);
          }
        } else {
          await handleSigned(text);
        }
      } catch (e: any) {
        setError(e.message);
      }
    }

    load();
  }, [cid]);

  // decrypt step
  async function decrypt(armored: string, pw: string) {
    try {
      const message = await openpgp.readMessage({
        armoredMessage: armored,
      });

      const { data: decrypted } = await openpgp.decrypt({
        message,
        passwords: [pw],
      });

      setNeedsPassword(false);

      await handleSigned(decrypted as string);
    } catch {
      setError("Invalid password or corrupted message");
    }
  }

  // signed message verification
  async function handleSigned(text: string) {
    const message = await openpgp.readCleartextMessage({
      cleartextMessage: text,
    });

    const keyIds = message.getSigningKeyIDs();
    const hexKeyId = keyIds[0].toHex().toLowerCase();
    setKeyId(hexKeyId);

    const testPub = getFingerprint(domain);
    const publicKey = await fetchPublicKey(await testPub);

    const result = await openpgp.verify({
      message,
      verificationKeys: publicKey,
    });

    try {
      await result.signatures[0].verified;
      const signature = await result.signatures[0].signature;
      setUser(publicKey.getUserIDs());
      setCreated(signature.packets[0].created);
      setVerified(true);
      setMarkdown(message.getText());
    } catch {
      setVerified(false);
    }
  }

  // DNS key lookup
  async function fetchPublicKey(fingerprint: string) {
    const res = await fetch(
      `https://keys.openpgp.org/vks/v1/by-fingerprint/${fingerprint}`,
    );

    const data = await res.text();

    return await openpgp.readKey({ armoredKey: data });
  }

  return (
    <Card className="mx-auto w-full">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex" style={{ textWrap: "wrap" }}>
          {cid}
        </CardTitle>
        <CardAction className="self-start sm:self-auto">
          <Item variant="outline">
            <ItemContent>
              {keyId && (
                <ItemTitle>
                  <strong>Key ID:</strong> {keyId}
                </ItemTitle>
              )}
              <ItemDescription>
                {verified && "Signed by: " + user?.join(", ")}
              </ItemDescription>
              <ItemDescription>
                {verified && "Signed at: " + created?.toLocaleString()}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              {verified ? (
                <div style={{ color: "green" }}>✔ Verified</div>
              ) : (
                <div style={{ color: "red" }}>X not verified</div>
              )}
            </ItemActions>
          </Item>
          {error && (
            <Item variant="outline">
              <ItemContent>
                <ItemDescription>{error}</ItemDescription>
              </ItemContent>
            </Item>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="text-base">
        {needsPassword && !verified && (
          <div>
            <p>🔒 Encrypted post</p>

            <Input
              type="password"
              value={password}
              placeholder="Enter password"
              onChange={(e) => setPassword(e.target.value)}
            ></Input>
            {/* <input /> */}

            <Button onClick={() => decrypt(raw, password)}>Unlock</Button>
          </div>
        )}

        {verified && (
          <div className="prose max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeSanitize, rehypeKatex]}
            >
              {markdown}
            </ReactMarkdown>
          </div>
        )}
        {!verified && !needsPassword && (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Data cannot be rendered</EmptyTitle>
              <EmptyDescription>
                Likely cannot verify signature or does not conform to the
                protocol
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
};
