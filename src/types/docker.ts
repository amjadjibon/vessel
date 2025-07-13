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