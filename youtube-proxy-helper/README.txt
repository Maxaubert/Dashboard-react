Dashboard YouTube Proxy
=======================

What is this?
-------------
A tiny helper that lets the dashboard's video downloader fetch
YouTube videos by routing the request through THIS PC's residential
internet connection instead of the Hetzner server's datacenter IP.

YouTube blocks datacenter IPs aggressively. By tunneling the
outbound HTTP request through your home connection, YouTube sees a
normal home user and lets the request through.

The actual download still happens on the SERVER (it does the heavy
lifting — yt-dlp, ffmpeg, file conversion). Only the small HTTP
request goes via this PC. That means downloads still work from any
device hitting your dashboard URL — phone, tablet, friend's laptop,
whatever — as long as this PC is on and the proxy is running.


How to use
----------
1. Make sure Python is installed on this PC.
   Test: open a new cmd window and type   python --version
   If you get an error, install Python from https://python.org
   (check "Add to PATH" during installation).

2. Make sure the OpenSSH client is enabled (built into Windows 10/11).
   Test: open a new cmd window and type   ssh -V
   If "ssh is not recognized", enable it via:
     Settings > Apps > Optional Features > Add a feature
     > "OpenSSH Client" > Install

3. Double-click  start_youtube_proxy.bat
   - The first time it asks for the server password, type it and
     press Enter.
   - Leave the window open. Minimise it if you want.
   - As long as it's open, YouTube downloads work in the dashboard.

4. To stop: close the window (or press Ctrl+C, then 'y').


When does it need to be running?
--------------------------------
ONLY when you want to download a YouTube video. Other 1000+ sites
that yt-dlp supports (TikTok, Vimeo, Twitter/X, Reddit, Twitch,
Instagram, Facebook, etc.) work without this — they don't have
YouTube's anti-bot system.

You can leave it running 24/7 if you want — it uses essentially zero
resources. Or only start it when you need to download from YouTube.


Files in this folder
--------------------
- socks5_proxy.py        Tiny pure-Python SOCKS5 proxy server
- start_youtube_proxy.bat Windows launcher (double-click this)
- README.txt             This file


Server side (already set up)
----------------------------
The dashboard server is configured to look for a SOCKS5 proxy on
127.0.0.1:1080. The launcher's SSH tunnel exposes THIS PC's local
proxy at server-side port 1080, so the server's yt-dlp can reach it
when downloading YouTube videos.

Config file on server: /opt/dashboard/yt-proxy.txt
Contents: socks5h://127.0.0.1:1080

(The 'h' in socks5h means DNS resolution happens at the proxy end —
i.e., DNS goes through this PC's home connection, not the server's.)


Optional: skip the password prompt
----------------------------------
If you don't want to type the password each time, set up SSH key
authentication:

  1. In a Windows terminal:
       ssh-keygen -t ed25519 -f %USERPROFILE%\.ssh\dashboard_key
     (just press Enter through the prompts)

  2. Upload your public key to the server:
       type %USERPROFILE%\.ssh\dashboard_key.pub | ssh root@37.27.210.14 "cat >> ~/.ssh/authorized_keys"

  3. Edit start_youtube_proxy.bat and change the ssh line to add:
       -i %USERPROFILE%\.ssh\dashboard_key

After that, the launcher won't prompt for a password.


Auto-start on boot
------------------
If you want the proxy to start automatically every time this PC boots:

  1. Press Win+R, type   shell:startup   and press Enter
  2. Right-click in the folder that opens, paste a SHORTCUT to
     start_youtube_proxy.bat (Right-click > New > Shortcut)
  3. Done — Windows will launch it on next boot

The launcher window will appear at login. Minimise it.
