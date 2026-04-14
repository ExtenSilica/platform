#!/usr/bin/env sh
# =============================================================================
# ExtenSilica xsil CLI — Unix installer
#
# Usage:
#   curl -fsSL https://extensilica.com/install.sh | sh
#
# Environment overrides (optional):
#   XSIL_VERSION     — install a specific version, e.g. XSIL_VERSION=v1.2.0
#   XSIL_INSTALL_DIR — install binary here instead of /usr/local/bin or ~/.local/bin
#
# Supported platforms:
#   Linux  x86_64 / aarch64  (fully static musl binary — no dependencies)
#   macOS  x86_64 / arm64    (Apple Silicon)
# =============================================================================
set -eu

REPO="extensilica/xsil"
BINARY="xsil"
RELEASES_URL="https://github.com/$REPO/releases"
API_URL="https://api.github.com/repos/$REPO/releases/latest"

# ── Helpers ───────────────────────────────────────────────────────────────────

say()  { printf "\033[1m%s\033[0m\n" "$*"; }
info() { printf "  \033[34m→\033[0m %s\n" "$*"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$*"; }
err()  { printf "\033[31merror:\033[0m %s\n" "$*" >&2; exit 1; }

need() {
    command -v "$1" >/dev/null 2>&1 || err "required tool not found: $1 — please install it and retry"
}

# ── Detect platform ───────────────────────────────────────────────────────────

detect_target() {
    OS=$(uname -s 2>/dev/null || echo "unknown")
    ARCH=$(uname -m 2>/dev/null || echo "unknown")

    case "$OS" in
        Linux)  OS_TYPE="linux"  ;;
        Darwin) OS_TYPE="darwin" ;;
        *)      err "Unsupported OS: $OS. Download manually from $RELEASES_URL" ;;
    esac

    case "$ARCH" in
        x86_64|amd64)  ARCH_TYPE="x86_64"  ;;
        aarch64|arm64) ARCH_TYPE="aarch64" ;;
        *)             err "Unsupported architecture: $ARCH. Download manually from $RELEASES_URL" ;;
    esac

    if [ "$OS_TYPE" = "linux" ]; then
        echo "${ARCH_TYPE}-unknown-linux-musl"
    else
        echo "${ARCH_TYPE}-apple-darwin"
    fi
}

# ── Checksum verification ─────────────────────────────────────────────────────

verify_checksum() {
    ARCHIVE="$1"
    SUMS_FILE="$2"

    # Try sha256sum (Linux), fall back to shasum (macOS)
    if command -v sha256sum >/dev/null 2>&1; then
        grep "$(basename "$ARCHIVE")" "$SUMS_FILE" | sha256sum -c - >/dev/null 2>&1 \
            || err "Checksum verification failed for $ARCHIVE — aborting"
    elif command -v shasum >/dev/null 2>&1; then
        grep "$(basename "$ARCHIVE")" "$SUMS_FILE" | shasum -a 256 -c - >/dev/null 2>&1 \
            || err "Checksum verification failed for $ARCHIVE — aborting"
    else
        printf "  \033[33m⚠\033[0m  sha256sum / shasum not found — skipping checksum verification\n"
    fi
}

# ── Resolve version ───────────────────────────────────────────────────────────

resolve_version() {
    if [ -n "${XSIL_VERSION:-}" ]; then
        echo "$XSIL_VERSION"
        return
    fi

    need curl
    # Fetch latest release tag (format: cli/vX.Y.Z), extract bare version
    RAW=$(curl -fsSL "$API_URL" 2>/dev/null) || err "Could not reach GitHub API. Check your internet connection."
    VERSION=$(printf '%s' "$RAW" | grep '"tag_name"' | sed 's/.*"cli\/\(v[^"]*\)".*/\1/')

    [ -n "$VERSION" ] || err "Could not determine latest version. Check $RELEASES_URL"
    echo "$VERSION"
}

# ── Choose install directory ──────────────────────────────────────────────────

choose_install_dir() {
    if [ -n "${XSIL_INSTALL_DIR:-}" ]; then
        echo "$XSIL_INSTALL_DIR"
        return
    fi

    if [ -w "/usr/local/bin" ]; then
        echo "/usr/local/bin"
    else
        echo "$HOME/.local/bin"
    fi
}

# ── Main ──────────────────────────────────────────────────────────────────────

say ""
say "xsil installer"
say "══════════════"

need curl
need tar

TARGET=$(detect_target)
VERSION=$(resolve_version)
INSTALL_DIR=$(choose_install_dir)

ARCHIVE="${BINARY}-${TARGET}.tar.gz"
BASE_URL="https://github.com/$REPO/releases/download/cli/$VERSION"

info "version   : $VERSION"
info "target    : $TARGET"
info "install to: $INSTALL_DIR"
say ""

# ── Download ──────────────────────────────────────────────────────────────────

TMP=$(mktemp -d)
# shellcheck disable=SC2064
trap "rm -rf '$TMP'" EXIT INT TERM

info "Downloading $ARCHIVE …"
curl -fsSL --progress-bar "$BASE_URL/$ARCHIVE"       -o "$TMP/$ARCHIVE"
curl -fsSL                "$BASE_URL/SHA256SUMS.txt"  -o "$TMP/SHA256SUMS.txt"

# ── Verify ────────────────────────────────────────────────────────────────────

info "Verifying checksum …"
verify_checksum "$TMP/$ARCHIVE" "$TMP/SHA256SUMS.txt"
ok  "Checksum OK"

# ── Extract and install ───────────────────────────────────────────────────────

tar xzf "$TMP/$ARCHIVE" -C "$TMP"

mkdir -p "$INSTALL_DIR"
mv "$TMP/$BINARY" "$INSTALL_DIR/$BINARY"
chmod +x "$INSTALL_DIR/$BINARY"

ok "$BINARY $VERSION installed → $INSTALL_DIR/$BINARY"
say ""

# ── PATH hint ─────────────────────────────────────────────────────────────────

case ":$PATH:" in
    *":$INSTALL_DIR:"*) ;;
    *)
        say "Add $INSTALL_DIR to your PATH:"
        say ""
        printf "  \033[90m# bash (~/.bashrc or ~/.bash_profile)\033[0m\n"
        printf "  export PATH=\"\$PATH:%s\"\n" "$INSTALL_DIR"
        say ""
        printf "  \033[90m# zsh (~/.zshrc)\033[0m\n"
        printf "  export PATH=\"\$PATH:%s\"\n" "$INSTALL_DIR"
        say ""
        ;;
esac

# ── Quick test ────────────────────────────────────────────────────────────────

if command -v "$BINARY" >/dev/null 2>&1; then
    say "Quick test:"
    "$BINARY" --version || true
fi

say ""
say "Done! Get started:"
say ""
printf "  xsil search         \033[90m# browse packages\033[0m\n"
printf "  xsil install <pkg>  \033[90m# install a package\033[0m\n"
printf "  xsil login          \033[90m# authenticate to publish\033[0m\n"
say ""
printf "Docs: \033[4mhttps://extensilica.com\033[0m\n"
say ""
