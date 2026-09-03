# DNS records for Resend — pitchfootball.com.au

Add these at the DNS host for pitchfootball.com.au (nameservers: nameserver.net.au).
"Name" is the relative form most registrar panels want; if yours wants the full
hostname, use the bracketed version.

## 1 · DKIM (required for sending)

| Type | Name | Value |
|---|---|---|
| TXT | `resend._domainkey.send` (full: `resend._domainkey.send.pitchfootball.com.au`) | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDSq4dPIefqkh+YXLb8i4ShoH/Sd8VoQvZEJs6G7hSyDf0RDmghdeO6XygSqcAyp4oJWSPY1/joHNHMTbS+C9uBH0NYDx0q8Aq4ynqPN8eZmp6vgGExGu75fZgDJmX2YrZygHxo/EqLQchDkNqWurArWeBkgIKLSaq84S9GnnHRawIDAQAB` |

## 2 · SPF / return-path (required for sending)

| Type | Name | Value |
|---|---|---|
| CNAME | `rsend.send` (full: `rsend.send.pitchfootball.com.au`) | `rsend-apne1.forge.rmta.net` |
| CNAME | `send.send` (full: `send.send.pitchfootball.com.au`) | `send.forge.rmta.net` |

## 3 · DMARC (required by D-81: p=none with reporting, within 48h of the domain landing)

| Type | Name | Value |
|---|---|---|
| TXT | `_dmarc` (full: `_dmarc.pitchfootball.com.au`) | `v=DMARC1; p=none; rua=mailto:burak.donmez@pitch-football.com` |

(Resend suggests plain `v=DMARC1; p=none;` — the added `rua=` gives the
reporting D-81 asks for.)

## 4 · Optional — inbound MX (only if we ever receive mail at send.*)

| Type | Name | Value | Priority |
|---|---|---|---|
| MX | `send` (full: `send.pitchfootball.com.au`) | `inbound-smtp.ap-northeast-1.amazonaws.com` | 10 |

After the records are live: back in Resend → Domains → send.pitchfootball.com.au
→ "I've added the records" / Verify. Then create an API key (Sending access
only) and paste it into Vercel as RESEND_API_KEY.
