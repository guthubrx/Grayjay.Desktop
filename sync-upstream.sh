#!/bin/bash
# Sync la branche perso avec les dernières mises à jour de FUTO upstream.
#
# Workflow merge-based :
#   1. Fetch upstream
#   2. Réinitialise perso sur upstream/master
#   3. Re-merge toutes les branches pr/* et feat/* (dans l'ordre alphabétique)
#   4. Re-applique les commits BlueJay-only (README fork notice)
#
# Utilisation :
#   ./sync-upstream.sh              # sync réel
#   ./sync-upstream.sh --dry-run    # affiche ce qui serait fait, sans rien changer
#
# La branche perso ne doit contenir QUE des merges de feat/* / pr/* et
# des commits BlueJay-only (jamais de commit de feature directement).

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

DRY_RUN=0
[ "$1" = "--dry-run" ] && DRY_RUN=1

echo "=== Sync Grayjay upstream (merge-based) ==="
echo ""

# --- 1. Pré-conditions ---
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "perso" ]; then
  echo "⚠  Tu n'es pas sur 'perso' (branche actuelle: '$BRANCH')"
  echo "   Lance: git checkout perso"
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "⚠  Modifications non commitées. Commite ou stash avant de sync :"
  git status --short
  exit 1
fi

# --- 2. Fetch upstream ---
echo "1. Fetch upstream..."
git fetch upstream

BEHIND=$(git rev-list --count perso..upstream/master)
echo "   $BEHIND nouveau(x) commit(s) upstream."

# --- 3. Lister les branches à re-merger ---
FEATURE_BRANCHES=$(git branch --format='%(refname:short)' | grep -E '^(pr|feat)/' | sort || true)
if [ -z "$FEATURE_BRANCHES" ]; then
  echo "   Aucune branche pr/* ou feat/* à merger."
else
  echo ""
  echo "2. Branches à re-merger dans perso :"
  echo "$FEATURE_BRANCHES" | sed 's/^/   - /'
fi

# --- 4. Lister les commits BlueJay-only à re-appliquer ---
# Ces commits ne sont pas dans les branches pr/*/feat/* : ce sont les modifs
# spécifiques au fork (README fork notice, scripts perso, etc.).
BLUEJAY_COMMITS=$(git log --format='%H %s' perso -- README.md sync-upstream.sh 2>/dev/null \
  | grep -iE 'fork|bluejay|sync-upstream' | awk '{print $1}' | tac || true)

echo ""
echo "3. Commits BlueJay-only à re-appliquer :"
if [ -z "$BLUEJAY_COMMITS" ]; then
  echo "   (aucun détecté)"
else
  echo "$BLUEJAY_COMMITS" | while read sha; do
    [ -n "$sha" ] && git log --format='   - %h %s' -1 $sha
  done
fi

# --- 5. Dry-run : on s'arrête ici ---
if [ $DRY_RUN -eq 1 ]; then
  echo ""
  echo "=== Dry-run terminé. Rien n'a été modifié. ==="
  exit 0
fi

# --- 6. Exécution réelle ---
echo ""
echo "4. Backup de perso → perso-backup-$(date +%Y%m%d-%H%M%S)"
BACKUP_NAME="perso-backup-$(date +%Y%m%d-%H%M%S)"
git branch "$BACKUP_NAME" perso

echo "5. Reset perso sur upstream/master..."
git reset --hard upstream/master

if [ -n "$FEATURE_BRANCHES" ]; then
  echo "6. Merge des branches features..."
  echo "$FEATURE_BRANCHES" | while read branch; do
    [ -z "$branch" ] && continue
    echo "   → merge --no-ff $branch"
    if ! git merge --no-ff "$branch" -m "Merge $branch into perso"; then
      echo ""
      echo "⚠  Conflit sur '$branch'. Résous puis relance 'git merge --continue'."
      echo "   Tu peux restaurer perso avec : git reset --hard $BACKUP_NAME"
      exit 1
    fi
  done
fi

if [ -n "$BLUEJAY_COMMITS" ]; then
  echo "7. Cherry-pick des commits BlueJay-only..."
  echo "$BLUEJAY_COMMITS" | while read sha; do
    [ -z "$sha" ] && continue
    # Chercher le commit dans perso-backup (où il existe toujours)
    if git branch --contains "$sha" "$BACKUP_NAME" &>/dev/null; then
      echo "   → cherry-pick $(git log --format='%h %s' -1 $sha)"
      if ! git cherry-pick "$sha"; then
        echo "⚠  Conflit sur $sha. Résous puis relance 'git cherry-pick --continue'."
        exit 1
      fi
    fi
  done
fi

echo ""
echo "=== Sync terminé ==="
git log --oneline -8
echo ""
echo "Backup de l'ancienne perso : $BACKUP_NAME"
echo "(à supprimer après vérification : git branch -D $BACKUP_NAME)"
