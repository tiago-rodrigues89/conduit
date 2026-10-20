# Conduit shell integration for bash.
# Expects: __conduit_style (conduit|frame|minimal|shell), optional
# __conduit_remote and __conduit_injected (set when typed into an SSH shell).
if [ -n "$__conduit_injected" ] && [[ -o history ]]; then
  # forget the injected line: reload the history list from the file
  history -c; [ -n "$HISTFILE" ] && history -r
fi
case "${LC_ALL:-${LC_CTYPE:-$LANG}}" in
  *[Uu][Tt][Ff]*) __conduit_arrow='❯'; __conduit_git='⎇ '; __conduit_x='✘ '; __conduit_f1='╭─'; __conduit_f2='╰─' ;;
  *) __conduit_arrow='>'; __conduit_git='git:'; __conduit_x='x'; __conduit_f1='+-'; __conduit_f2='\\-' ;;
esac
__conduit_user=$(id -un 2>/dev/null || echo "$USER")
__conduit_n=
__conduit_hn=
__conduit_prompt() {
  local ec=$? h hn
  # OSC 7 reports the folder, OSC 6973 the user (Files panel follows both)
  printf '\033]7;file://%s%s\007\033]6973;user=%s\007' "$HOSTNAME" "$PWD" "$__conduit_user"
  # OSC 6973 "cmd=<base64>": the command that just ran (history panel)
  h=$(HISTTIMEFORMAT= builtin history 1 2>/dev/null)
  h=${h#"${h%%[![:space:]]*}"}; hn=${h%%[[:space:]]*}
  if [ -n "$hn" ] && [ "$hn" != "$__conduit_hn" ]; then
    [ -n "$__conduit_hn" ] && printf '\033]6973;cmd=%s\007' "$(printf '%s' "${h#*[[:space:]][[:space:]]}" | base64 | tr -d '\n')"
    __conduit_hn=$hn
  fi
  if [ "$__conduit_style" != shell ]; then
    local b who info arrow p=
    b=$(git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD 2>/dev/null)
    b=${b//\\/\\\\}; b=${b//\$/\\\$}; b=${b//\`/\\\`}
    if [ "$EUID" = 0 ]; then who='\[\e[1;31m\]\u\[\e[0m\]'; else who='\[\e[1;34m\]\u\[\e[0m\]'; fi
    [ -n "$__conduit_remote" ] && who="$who"'\[\e[90m\]@\h\[\e[0m\]'
    if [ $ec -ne 0 ]; then arrow="\[\e[31m\]$__conduit_arrow\[\e[0m\]"; else arrow="\[\e[32m\]$__conduit_arrow\[\e[0m\]"; fi
    if [ "$__conduit_style" = minimal ]; then
      p="$who \[\e[1;36m\]\W\[\e[0m\]"
      [ -n "$b" ] && p="$p \[\e[35m\]$b\[\e[0m\]"
      PS1="$p $arrow "
    else
      info="$who  \[\e[1;36m\]\w\[\e[0m\]"
      [ -n "$b" ] && info="$info  \[\e[35m\]$__conduit_git$b\[\e[0m\]"
      [ $ec -ne 0 ] && info="$info  \[\e[31m\]$__conduit_x$ec\[\e[0m\]"
      [ -n "$__conduit_n" ] && p='\n'
      __conduit_n=1
      if [ "$__conduit_style" = frame ]; then
        PS1="$p\[\e[90m\]$__conduit_f1\[\e[0m\] $info\n\[\e[90m\]$__conduit_f2\[\e[0m\]$arrow "
      else
        PS1="$p$info\n$arrow "
      fi
    fi
  fi
  return $ec
}
PROMPT_DIRTRIM=3
PROMPT_COMMAND="__conduit_prompt${PROMPT_COMMAND:+;$PROMPT_COMMAND}"
