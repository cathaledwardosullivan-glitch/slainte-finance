# Inventise Call — What We Need and Why

## What we're trying to do

We've built a health check tool for the practice that analyses patient numbers — things like how many GMS patients are over 70, how many have diabetes, etc. Right now the staff have to look these numbers up manually in Socrates and type them in. We want to automate that by letting our tool query the Socrates database directly for those counts.

## What the tool actually does

It runs very simple queries — essentially just "how many patients match this criteria?" No names, no addresses, no clinical notes. Just totals. The data never leaves the practice network.

## Where the database lives

Socrates stores its data in a SQL Server Express database. That database is on a virtual machine called **VM-H1SERVER**, which runs on the practice's Hyper-V server (GRIFFITH-HYPERV). There's also a domain controller VM (GRIFFITH-VM-DC) on the same box.

## Why we're stuck

When we try to connect to VM-H1SERVER — whether by remote desktop, network shares, or anything else — it asks for Clanwilliam credentials that the practice doesn't have. We can't get onto the machine at all, which means we can't even see what the database looks like inside, let alone query it.

## What we need from Inventise

Three things, in order of priority:

1. **Access to the VM** — Can you log into VM-H1SERVER? You set up the Hyper-V environment, so you may have local admin credentials or be able to connect through the Hyper-V console directly.

2. **A database login** — If you can get on, we need a SQL Server login that can read (but not write to) the Socrates database. The technical term is "db_datareader" — it's the most locked-down level of access available.

3. **Network connectivity** — The database needs to accept connections from other machines on the practice network. This means enabling TCP/IP in the SQL Server settings and opening the port in Windows Firewall. Both are toggles rather than anything complicated.

## What if Inventise can't access it?

Then it's likely that only Clanwilliam can do this, and we'd need to go through them instead. Even knowing that for certain would be helpful.

## How long should it take?

If you have access, the whole thing is probably 10–15 minutes of work. We're happy to be on the call to guide the steps if that helps.

---

## If they get in while we're on the call — what to do next

If Inventise dials into VM-H1SERVER and sets up access for you there and then, here's what to do before hanging up:

### Step 1 — Write down the connection details

Ask them to confirm:
- The exact SQL Server instance name (we think it's `ideas\SQLEXPRESS` but it could be different)
- The username and password they've just created for you
- The port number (usually 1433 unless they've changed it)

### Step 2 — Test the connection from your PC

While they're still on the line, open a command prompt on your practice PC and type:

```
sqlcmd -S 192.168.1.7\SQLEXPRESS -U [the username] -P [the password]
```

If you get a `1>` prompt, you're connected. If you get an error, Inventise can troubleshoot while they're still logged in — it's usually the firewall or TCP/IP setting.

### Step 3 — Get the database structure

This is the bit we really need. Once you're at that `1>` prompt, run these commands one at a time (type each line, then press Enter, then type `GO` and press Enter):

```
USE socrates
GO
```

Then:

```
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES ORDER BY TABLE_NAME
GO
```

This will print out all the table names in the database. **Copy or screenshot everything** — it could be a long list, and that's fine. This is the map we need to write our queries.

If you want to go further (and there's time), pick any table that looks relevant (e.g. something with "patient" or "diagnosis" in the name) and run:

```
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TableNameHere' ORDER BY COLUMN_NAME
GO
```

This shows what's inside that table — the column names and what type of data they hold.

### Step 4 — Wrap up

That's all we need from the call. With the connection details and the table list, we can take it from there and build the queries ourselves.
