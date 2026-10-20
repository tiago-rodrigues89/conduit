import {
  Cable,
  CloudCog,
  Code,
  FolderTree,
  Laptop,
  Monitor,
  ScreenShare,
  SquareTerminal,
  Usb,
  type LucideIcon,
} from 'lucide-react';
import type { SessionItem, SessionType } from './types';

export interface SessionTypeInfo {
  type: SessionType;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  /** how a double click opens it */
  opens: 'terminal' | 'sftp' | 'external';
  /** editor sections shown for this type */
  sections: ('general' | 'auth' | 'terminal' | 'automation' | 'tunnels' | 'advanced')[];
  /** is there a host to connect to */
  network: boolean;
  defaults: Partial<SessionItem>;
}

export const SESSION_TYPES: Record<SessionType, SessionTypeInfo> = {
  ssh: {
    type: 'ssh',
    label: 'SSH',
    description: 'Secure shell with SFTP file panel',
    icon: SquareTerminal,
    color: '#82aaff',
    opens: 'terminal',
    sections: ['general', 'auth', 'terminal', 'automation', 'tunnels', 'advanced'],
    network: true,
    defaults: { port: 22 },
  },
  sftp: {
    type: 'sftp',
    label: 'SFTP',
    description: 'File browser only, FileZilla-style',
    icon: FolderTree,
    color: '#5ee1e6',
    opens: 'sftp',
    sections: ['general', 'auth', 'advanced'],
    network: true,
    defaults: { port: 22 },
  },
  local: {
    type: 'local',
    label: 'Local shell',
    description: 'A terminal on this Mac',
    icon: Laptop,
    color: '#c792ea',
    opens: 'terminal',
    sections: ['general', 'terminal', 'automation'],
    network: false,
    defaults: { port: 0 },
  },
  telnet: {
    type: 'telnet',
    label: 'Telnet',
    description: 'Switches, routers and old devices',
    icon: Cable,
    color: '#ffd479',
    opens: 'terminal',
    sections: ['general', 'terminal', 'automation'],
    network: true,
    defaults: { port: 23 },
  },
  serial: {
    type: 'serial',
    label: 'Serial',
    description: 'Console cable / USB-serial adapter',
    icon: Usb,
    color: '#ff9e64',
    opens: 'terminal',
    sections: ['general', 'terminal', 'automation'],
    network: false,
    defaults: { port: 0, baudRate: 115200 },
  },
  rdp: {
    type: 'rdp',
    label: 'RDP',
    description: 'Windows Remote Desktop (opens Windows App)',
    icon: Monitor,
    color: '#6cb6ff',
    opens: 'external',
    sections: ['general'],
    network: true,
    defaults: { port: 3389 },
  },
  vnc: {
    type: 'vnc',
    label: 'VNC',
    description: 'Screen sharing (opens macOS Screen Sharing)',
    icon: ScreenShare,
    color: '#7ee2a8',
    opens: 'external',
    sections: ['general'],
    network: true,
    defaults: { port: 5900 },
  },
  ssm: {
    type: 'ssm',
    label: 'AWS Session Manager',
    description: 'EC2 shell without open ports (aws CLI)',
    icon: CloudCog,
    color: '#ff9e64',
    opens: 'terminal',
    sections: ['general', 'terminal', 'automation'],
    network: false,
    defaults: { port: 0 },
  },
  command: {
    type: 'command',
    label: 'Command',
    description: 'Run any command, e.g. docker exec or kubectl',
    icon: Code,
    color: '#a0a8b8',
    opens: 'terminal',
    sections: ['general', 'terminal', 'automation'],
    network: false,
    defaults: { port: 0 },
  },
};

/** Cards in the "new session" wizard. AWS EC2 is SSH with EC2 defaults. */
export interface Template {
  id: string;
  type: SessionType;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  defaults: Partial<SessionItem>;
}

export const TEMPLATES: Template[] = [
  ...(['ssh', 'sftp', 'local', 'telnet', 'serial', 'rdp', 'vnc'] as SessionType[]).map((t) => ({
    id: t,
    type: t,
    label: SESSION_TYPES[t].label,
    description: SESSION_TYPES[t].description,
    icon: SESSION_TYPES[t].icon,
    color: SESSION_TYPES[t].color,
    defaults: SESSION_TYPES[t].defaults,
  })),
  {
    id: 'aws-ec2',
    type: 'ssh',
    label: 'AWS EC2',
    description: 'SSH with your key pair (.pem)',
    icon: CloudCog,
    color: '#ff9e64',
    defaults: { port: 22, username: 'ec2-user', authMethod: 'key', icon: 'aws' },
  },
  {
    id: 'ssm',
    type: 'ssm',
    label: 'AWS SSM',
    description: SESSION_TYPES.ssm.description,
    icon: CloudCog,
    color: '#ffd479',
    defaults: { ...SESSION_TYPES.ssm.defaults, icon: 'aws' },
  },
  {
    id: 'command',
    type: 'command',
    label: 'Command',
    description: SESSION_TYPES.command.description,
    icon: Code,
    color: SESSION_TYPES.command.color,
    defaults: SESSION_TYPES.command.defaults,
  },
];

export function typeInfo(type: SessionType | undefined): SessionTypeInfo {
  return SESSION_TYPES[type || 'ssh'] || SESSION_TYPES.ssh;
}

/** Short description of where a session goes, for the tree and tooltips. */
export function sessionTarget(s: SessionItem): string {
  switch (s.type) {
    case 'local':
      return 'This Mac';
    case 'command':
      return s.command.split('\n')[0];
    case 'serial':
      return `${s.serialDevice.replace('/dev/', '') || 'serial'} @ ${s.baudRate}`;
    case 'ssm':
      return s.awsInstanceId || 'SSM';
    default: {
      const info = typeInfo(s.type);
      const port = s.port && s.port !== info.defaults.port ? `:${s.port}` : '';
      return `${s.host}${port}`;
    }
  }
}

/** The command line for AWS Session Manager sessions. */
export function ssmCommand(s: SessionItem): string {
  const q = (v: string) => (/^[\w.:/@-]+$/.test(v) ? v : `'${v.replace(/'/g, `'\\''`)}'`);
  let cmd = `aws ssm start-session --target ${q(s.awsInstanceId.trim())}`;
  if (s.awsRegion.trim()) cmd += ` --region ${q(s.awsRegion.trim())}`;
  if (s.awsProfile.trim()) cmd += ` --profile ${q(s.awsProfile.trim())}`;
  return cmd;
}
