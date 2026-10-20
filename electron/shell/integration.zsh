# Conduit shell integration for zsh.
# Expects: __conduit_style (conduit|frame|minimal|shell), optional
# __conduit_remote and __conduit_injected (set when typed into an SSH shell).
autoload -Uz add-zsh-hook
__conduit_user=${USERNAME:-$(id -un 2>/dev/null)}
# OSC 7 reports the folder, OSC 6973 the user (Files panel follows both)
__conduit_cwd() { printf '\033]7;file://%s%s\007\033]6973;user=%s\007' "$HOST" "$PWD" "$__conduit_user" }
add-zsh-hook precmd __conduit_cwd
# OSC 6973 "cmd=<base64>": each command that runs (history panel)
__conduit_cmd() { printf '\033]6973;cmd=%s\007' "$(printf '%s' "$1" | base64 | tr -d '\n')" }
add-zsh-hook preexec __conduit_cmd

if [[ -n $__conduit_injected ]]; then
  # remove the injected line from the history (once, at the first prompt)
  __conduit_h() {
    add-zsh-hook -d precmd __conduit_h
    local f=$HISTFILE s=$HISTSIZE v=$SAVEHIST t
    if [[ -n $f && -f $f && -w $f ]] && grep -qa __conduit_ "$f" && t=$(mktemp); then
      grep -av __conduit_ "$f" >| "$t" && cat "$t" >| "$f"; rm -f "$t"
    fi
    HISTFILE=
    if [[ -n $f ]]; then fc -p "$f" "$s" "$v"; else fc -p; HISTSIZE=$s; fi
  }
  add-zsh-hook precmd __conduit_h
fi

if [[ $__conduit_style != shell ]]; then
  zmodload zsh/datetime 2>/dev/null
  autoload -Uz vcs_info
  zstyle ':vcs_info:*' enable git
  zstyle ':vcs_info:git:*' formats '%b'
  zstyle ':vcs_info:git:*' actionformats '%b|%a'
  unsetopt prompt_subst
  if [[ ${LC_ALL:-${LC_CTYPE:-$LANG}} == *[Uu][Tt][Ff]* ]]; then
    __conduit_sym=('❯' '⎇' '✘' '↻' '╭─' '╰─')
  else
    __conduit_sym=('>' 'git:' 'x' 'took' '+-' '\-')
  fi
  __conduit_t0=
  __conduit_n=0
  __conduit_pre() { __conduit_t0=$EPOCHREALTIME }
  __conduit_prompt() {
    local ec=$? took= b p info who='%B%F{blue}%n%b' nl=$'\n'
    (( EUID == 0 )) && who='%B%F{red}%n%b'
    [[ -n $__conduit_remote ]] && who+='%F{8}@%m'
    who+='%f'
    vcs_info 2>/dev/null
    b=${vcs_info_msg_0_//\%/%%}
    if [[ -n $__conduit_t0 && -n $EPOCHREALTIME ]]; then
      local -i s=$(( EPOCHREALTIME - __conduit_t0 ))
      if (( s >= 60 )); then took="$((s / 60))m $((s % 60))s"; elif (( s >= 2 )); then took="${s}s"; fi
    fi
    __conduit_t0=
    local arrow="%F{green}$__conduit_sym[1]%f"
    (( ec )) && arrow="%F{red}$__conduit_sym[1]%f"
    if [[ $__conduit_style == minimal ]]; then
      p="$who %B%F{cyan}%2~%f%b"
      [[ -n $b ]] && p+=" %F{magenta}$b%f"
      [[ -n $took ]] && p+=" %F{yellow}$took%f"
      PROMPT="$p $arrow "
    else
      info="$who  %B%F{cyan}%(5~|…/%3~|%~)%f%b"
      [[ -n $b ]] && info+="  %F{magenta}$__conduit_sym[2] $b%f"
      [[ -n $took ]] && info+="  %F{yellow}$__conduit_sym[4] $took%f"
      (( ec )) && info+="  %F{red}$__conduit_sym[3] $ec%f"
      (( __conduit_n++ )) && p=$nl
      if [[ $__conduit_style == frame ]]; then
        p+="%F{8}$__conduit_sym[5]%f $info$nl%F{8}$__conduit_sym[6]%f$arrow "
      else
        p+="$info$nl$arrow "
      fi
      PROMPT=$p
    fi
    RPROMPT=
  }
  add-zsh-hook preexec __conduit_pre
  precmd_functions=(__conduit_prompt ${precmd_functions:#__conduit_prompt})
fi
