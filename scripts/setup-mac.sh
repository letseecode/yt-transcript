#!/usr/bin/env bash
# One-shot dev setup for YourTranscript on a fresh macOS machine.
# Usage:  bash setup-mac.sh
# It is safe to re-run; each step checks whether the tool already exists.
set -e

echo "==> Checking Homebrew..."
if ! command -v brew >/dev/null 2>&1; then
  echo "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Put brew on PATH for Apple-silicon Macs, this session and future ones.
  if [ -d /opt/homebrew/bin ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
    grep -q 'brew shellenv' ~/.zprofile 2>/dev/null || \
      echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
  fi
else
  echo "Homebrew already installed."
fi

echo "==> Installing Node, git, GitHub CLI..."
brew install node git gh || true

echo "==> Installing VS Code..."
brew install --cask visual-studio-code || true

echo "==> Installing Vercel CLI (for deploys)..."
npm install -g vercel || true

echo
echo "Installed versions:"
echo "  node   $(node --version 2>/dev/null || echo 'MISSING')"
echo "  npm    $(npm --version 2>/dev/null || echo 'MISSING')"
echo "  git    $(git --version 2>/dev/null || echo 'MISSING')"
echo "  gh     $(gh --version 2>/dev/null | head -1 || echo 'MISSING')"
echo "  code   $(code --version 2>/dev/null | head -1 || echo 'MISSING (open VS Code once, then run: Shell Command: Install code command)')"

cat <<'NEXT'

==> Almost done. Finish these by hand:

1) Sign in to GitHub:
     gh auth login
     (GitHub.com -> HTTPS -> Login with a web browser)

2) Get the project and install its libraries:
     mkdir -p ~/Projects && cd ~/Projects
     git clone https://github.com/letseecode/yt-transcript.git
     cd yt-transcript
     npm install
     code .

3) Create a file named  .env.local  in the project root with your keys:
     DATABASE_URL=...
     GEMINI_API_KEY=...
     SUPADATA_API_KEY=...
     GOOGLE_CLIENT_ID=...
     GOOGLE_CLIENT_SECRET=...
   (Copy the values from your Vercel project's Environment Variables page.)

4) Run it:
     npm run dev
   Then open http://localhost:3000

NEXT
echo "Setup script finished."
