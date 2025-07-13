export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  created: number;
  ports: PortInfo[];
}

export interface PortInfo {
  private_port: number;
  public_port?: number;
  type: string;
}

export interface ImageInfo {
  id: string;
  repo_tags: string[];
  repo_digests: string[];
  created: number;
  size: number;
  virtual_size: number;
  shared_size: number;
  labels: Record<string, string>;
}

export interface VolumeInfo {
  name: string;
  driver: string;
  mountpoint: string;
  created_at?: string;
  labels: Record<string, string>;
  options: Record<string, string>;
  scope: string;
}

export interface NetworkInfo {
  id: string;
  name: string;
  driver: string;
  scope: string;
  created?: string;
  internal: boolean;
  attachable: boolean;
  ingress: boolean;
  ipam: NetworkIpam;
  containers: Record<string, NetworkContainer>;
  options: Record<string, string>;
  labels: Record<string, string>;
}

export interface NetworkIpam {
  driver?: string;
  config: IpamConfig[];
  options: Record<string, string>;
}

export interface IpamConfig {
  subnet?: string;
  gateway?: string;
  ip_range?: string;
}

export interface NetworkContainer {
  name?: string;
  endpoint_id?: string;
  mac_address?: string;
  ipv4_address?: string;
  ipv6_address?: string;
}

export interface TerminalCommand {
  command: string;
  args: string[];
  working_dir?: string;
}

export interface TerminalOutput {
  stdout: string;
  stderr: string;
  exit_code?: number;
  success: boolean;
}

export interface TerminalEntry {
  id: string;
  command: string;
  output: TerminalOutput;
  timestamp: Date;
  isExecuting?: boolean;
}