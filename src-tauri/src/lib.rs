use bollard::Docker;
use bollard::container::{ListContainersOptions, RemoveContainerOptions};
use bollard::image::ListImagesOptions;
use bollard::volume::ListVolumesOptions;
use bollard::network::ListNetworksOptions;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;
use tokio::process::Command as TokioCommand;
use sysinfo::System;
// use tokio::time::{timeout, Duration};
// use futures_util::StreamExt;

#[derive(Debug, Serialize, Deserialize)]
pub struct ContainerInfo {
    pub id: String,
    pub name: String,
    pub image: String,
    pub status: String,
    pub state: String,
    pub created: i64,
    pub ports: Vec<PortInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PortInfo {
    pub private_port: u16,
    pub public_port: Option<u16>,
    pub r#type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageInfo {
    pub id: String,
    pub repo_tags: Vec<String>,
    pub repo_digests: Vec<String>,
    pub created: i64,
    pub size: i64,
    pub virtual_size: i64,
    pub shared_size: i64,
    pub labels: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VolumeInfo {
    pub name: String,
    pub driver: String,
    pub mountpoint: String,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
    pub options: HashMap<String, String>,
    pub scope: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkInfo {
    pub id: String,
    pub name: String,
    pub driver: String,
    pub scope: String,
    pub created: Option<String>,
    pub internal: bool,
    pub attachable: bool,
    pub ingress: bool,
    pub ipam: NetworkIpam,
    pub containers: HashMap<String, NetworkContainer>,
    pub options: HashMap<String, String>,
    pub labels: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkIpam {
    pub driver: Option<String>,
    pub config: Vec<IpamConfig>,
    pub options: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IpamConfig {
    pub subnet: Option<String>,
    pub gateway: Option<String>,
    pub ip_range: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkContainer {
    pub name: Option<String>,
    pub endpoint_id: Option<String>,
    pub mac_address: Option<String>,
    pub ipv4_address: Option<String>,
    pub ipv6_address: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TerminalCommand {
    pub command: String,
    pub args: Vec<String>,
    pub working_dir: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TerminalOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub success: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemStats {
    pub cpu_usage: f32,
    pub memory_used: u64,
    pub memory_total: u64,
    pub memory_used_gb: f64,
    pub memory_total_gb: f64,
    pub disk_used: u64,
    pub disk_total: u64,
    pub disk_used_gb: f64,
    pub disk_total_gb: f64,
    pub cpu_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContainerStats {
    pub id: String,
    pub name: String,
    pub cpu_percentage: f64,
    pub memory_usage: u64,
    pub memory_limit: u64,
    pub memory_percentage: f64,
    pub network_rx: u64,
    pub network_tx: u64,
    pub block_read: u64,
    pub block_write: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DockerSystemInfo {
    pub containers_running: usize,
    pub containers_stopped: usize,
    pub containers_total: usize,
    pub images_total: usize,
    pub volumes_total: usize,
    pub networks_total: usize,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn list_containers() -> Result<Vec<ContainerInfo>, String> {
    let docker = Docker::connect_with_socket_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    let options = Some(ListContainersOptions::<String> {
        all: true,
        ..Default::default()
    });

    let containers = docker
        .list_containers(options)
        .await
        .map_err(|e| format!("Failed to list containers: {}", e))?;

    let container_info: Vec<ContainerInfo> = containers
        .into_iter()
        .map(|container| {
            let name = container
                .names
                .and_then(|names| names.first().cloned())
                .unwrap_or_else(|| "unnamed".to_string())
                .trim_start_matches('/')
                .to_string();

            let ports = container
                .ports
                .unwrap_or_default()
                .into_iter()
                .map(|port| PortInfo {
                    private_port: port.private_port,
                    public_port: port.public_port,
                    r#type: port.typ.map(|t| t.to_string()).unwrap_or_else(|| "tcp".to_string()),
                })
                .collect();

            ContainerInfo {
                id: container.id.unwrap_or_else(|| "unknown".to_string()),
                name,
                image: container.image.unwrap_or_else(|| "unknown".to_string()),
                status: container.status.unwrap_or_else(|| "unknown".to_string()),
                state: container.state.unwrap_or_else(|| "unknown".to_string()),
                created: container.created.unwrap_or(0),
                ports,
            }
        })
        .collect();

    Ok(container_info)
}

#[tauri::command]
async fn start_container(container_id: String) -> Result<String, String> {
    let docker = Docker::connect_with_socket_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    docker
        .start_container(&container_id, None::<bollard::container::StartContainerOptions<String>>)
        .await
        .map_err(|e| format!("Failed to start container: {}", e))?;

    Ok(format!("Container {} started successfully", container_id))
}

#[tauri::command]
async fn stop_container(container_id: String) -> Result<String, String> {
    let docker = Docker::connect_with_socket_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    docker
        .stop_container(&container_id, None)
        .await
        .map_err(|e| format!("Failed to stop container: {}", e))?;

    Ok(format!("Container {} stopped successfully", container_id))
}

#[tauri::command]
async fn restart_container(container_id: String) -> Result<String, String> {
    let docker = Docker::connect_with_socket_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    docker
        .restart_container(&container_id, None)
        .await
        .map_err(|e| format!("Failed to restart container: {}", e))?;

    Ok(format!("Container {} restarted successfully", container_id))
}

#[tauri::command]
async fn list_images() -> Result<Vec<ImageInfo>, String> {
    let docker = Docker::connect_with_socket_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    let options = Some(ListImagesOptions::<String> {
        all: true,
        ..Default::default()
    });

    let images = docker
        .list_images(options)
        .await
        .map_err(|e| format!("Failed to list images: {}", e))?;

    let image_info: Vec<ImageInfo> = images
        .into_iter()
        .map(|image| ImageInfo {
            id: image.id,
            repo_tags: image.repo_tags,
            repo_digests: image.repo_digests,
            created: image.created,
            size: image.size,
            virtual_size: image.virtual_size.unwrap_or(0),
            shared_size: image.shared_size,
            labels: image.labels,
        })
        .collect();

    Ok(image_info)
}

#[tauri::command]
async fn remove_image(image_id: String) -> Result<String, String> {
    let docker = Docker::connect_with_socket_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    docker
        .remove_image(&image_id, None, None)
        .await
        .map_err(|e| format!("Failed to remove image: {}", e))?;

    Ok(format!("Image {} removed successfully", image_id))
}

#[tauri::command]
async fn list_volumes() -> Result<Vec<VolumeInfo>, String> {
    let docker = Docker::connect_with_socket_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    let options = ListVolumesOptions::<String> {
        ..Default::default()
    };

    let volumes_response = docker
        .list_volumes(Some(options))
        .await
        .map_err(|e| format!("Failed to list volumes: {}", e))?;

    let volume_info: Vec<VolumeInfo> = volumes_response
        .volumes
        .unwrap_or_default()
        .into_iter()
        .map(|volume| VolumeInfo {
            name: volume.name,
            driver: volume.driver,
            mountpoint: volume.mountpoint,
            created_at: volume.created_at,
            labels: volume.labels,
            options: volume.options,
            scope: volume.scope.map(|s| s.to_string()).unwrap_or_else(|| "local".to_string()),
        })
        .collect();

    Ok(volume_info)
}

#[tauri::command]
async fn remove_volume(volume_name: String) -> Result<String, String> {
    let docker = Docker::connect_with_socket_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    docker
        .remove_volume(&volume_name, None)
        .await
        .map_err(|e| format!("Failed to remove volume: {}", e))?;

    Ok(format!("Volume {} removed successfully", volume_name))
}

#[tauri::command]
async fn list_networks() -> Result<Vec<NetworkInfo>, String> {
    let docker = Docker::connect_with_socket_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    let options = Some(ListNetworksOptions::<String> {
        ..Default::default()
    });

    let networks = docker
        .list_networks(options)
        .await
        .map_err(|e| format!("Failed to list networks: {}", e))?;

    let network_info: Vec<NetworkInfo> = networks
        .into_iter()
        .map(|network| {
            let ipam_config = network
                .ipam
                .as_ref()
                .and_then(|ipam| ipam.config.as_ref())
                .map(|configs| {
                    configs
                        .iter()
                        .map(|config| IpamConfig {
                            subnet: config.subnet.clone(),
                            gateway: config.gateway.clone(),
                            ip_range: config.ip_range.clone(),
                        })
                        .collect()
                })
                .unwrap_or_default();

            let containers = network
                .containers
                .unwrap_or_default()
                .into_iter()
                .map(|(key, container)| {
                    (
                        key,
                        NetworkContainer {
                            name: container.name,
                            endpoint_id: container.endpoint_id,
                            mac_address: container.mac_address,
                            ipv4_address: container.ipv4_address,
                            ipv6_address: container.ipv6_address,
                        },
                    )
                })
                .collect();

            NetworkInfo {
                id: network.id.unwrap_or_default(),
                name: network.name.unwrap_or_default(),
                driver: network.driver.unwrap_or_default(),
                scope: network.scope.unwrap_or_default(),
                created: network.created,
                internal: network.internal.unwrap_or(false),
                attachable: network.attachable.unwrap_or(false),
                ingress: network.ingress.unwrap_or(false),
                ipam: NetworkIpam {
                    driver: network.ipam.as_ref().and_then(|ipam| ipam.driver.clone()),
                    config: ipam_config,
                    options: network
                        .ipam
                        .as_ref()
                        .and_then(|ipam| ipam.options.clone())
                        .unwrap_or_default(),
                },
                containers,
                options: network.options.unwrap_or_default(),
                labels: network.labels.unwrap_or_default(),
            }
        })
        .collect();

    Ok(network_info)
}

#[tauri::command]
async fn remove_network(network_id: String) -> Result<String, String> {
    let docker = Docker::connect_with_socket_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    docker
        .remove_network(&network_id)
        .await
        .map_err(|e| format!("Failed to remove network: {}", e))?;

    Ok(format!("Network {} removed successfully", network_id))
}

#[tauri::command]
async fn execute_command(command: String) -> Result<TerminalOutput, String> {
    // Parse the command string into command and arguments
    let parts: Vec<&str> = command.trim().split_whitespace().collect();
    if parts.is_empty() {
        return Err("Empty command".to_string());
    }

    let cmd = parts[0];
    let args: Vec<&str> = if parts.len() > 1 { parts[1..].to_vec() } else { vec![] };

    // Create the command
    let mut tokio_cmd = TokioCommand::new(cmd);
    tokio_cmd.args(&args);
    tokio_cmd.stdout(Stdio::piped());
    tokio_cmd.stderr(Stdio::piped());

    // Execute the command
    match tokio_cmd.output().await {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            let exit_code = output.status.code();
            let success = output.status.success();

            Ok(TerminalOutput {
                stdout,
                stderr,
                exit_code,
                success,
            })
        }
        Err(e) => Err(format!("Failed to execute command: {}", e)),
    }
}

#[tauri::command]
async fn get_current_directory() -> Result<String, String> {
    match std::env::current_dir() {
        Ok(path) => Ok(path.to_string_lossy().to_string()),
        Err(e) => Err(format!("Failed to get current directory: {}", e)),
    }
}

#[tauri::command]
async fn change_directory(path: String) -> Result<String, String> {
    match std::env::set_current_dir(&path) {
        Ok(_) => Ok(format!("Changed directory to: {}", path)),
        Err(e) => Err(format!("Failed to change directory: {}", e)),
    }
}

#[tauri::command]
async fn execute_docker_command(args: Vec<String>) -> Result<TerminalOutput, String> {
    let mut cmd = TokioCommand::new("docker");
    cmd.args(&args);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    match cmd.output().await {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            let exit_code = output.status.code();
            let success = output.status.success();

            Ok(TerminalOutput {
                stdout,
                stderr,
                exit_code,
                success,
            })
        }
        Err(e) => Err(format!("Failed to execute docker command: {}", e)),
    }
}

#[tauri::command]
async fn get_system_stats() -> Result<SystemStats, String> {
    let mut sys = System::new_all();
    sys.refresh_all();
    
    let cpu_usage = sys.global_cpu_info().cpu_usage();
    let memory_used = sys.used_memory();
    let memory_total = sys.total_memory();
    
    // Simplified disk usage - use placeholder values for now
    let disk_used: u64 = 50 * 1024 * 1024 * 1024; // 50GB used as placeholder
    let disk_total: u64 = 1000 * 1024 * 1024 * 1024; // 1TB total as placeholder
    
    let cpu_count = sys.cpus().len();
    
    Ok(SystemStats {
        cpu_usage,
        memory_used,
        memory_total,
        memory_used_gb: memory_used as f64 / 1_073_741_824.0, // Convert to GB
        memory_total_gb: memory_total as f64 / 1_073_741_824.0,
        disk_used,
        disk_total,
        disk_used_gb: disk_used as f64 / 1_073_741_824.0,
        disk_total_gb: disk_total as f64 / 1_073_741_824.0,
        cpu_count,
    })
}

#[tauri::command]
async fn get_docker_system_info() -> Result<DockerSystemInfo, String> {
    let docker = Docker::connect_with_socket_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    // Get containers
    let containers = docker
        .list_containers(Some(ListContainersOptions::<String> {
            all: true,
            ..Default::default()
        }))
        .await
        .map_err(|e| format!("Failed to list containers: {}", e))?;

    let containers_total = containers.len();
    let containers_running = containers
        .iter()
        .filter(|c| c.state.as_ref().map(|s| s == "running").unwrap_or(false))
        .count();
    let containers_stopped = containers_total - containers_running;

    // Get images
    let images = docker
        .list_images(Some(ListImagesOptions::<String> {
            all: true,
            ..Default::default()
        }))
        .await
        .map_err(|e| format!("Failed to list images: {}", e))?;

    // Get volumes
    let volumes_response = docker
        .list_volumes(Some(ListVolumesOptions::<String> {
            ..Default::default()
        }))
        .await
        .map_err(|e| format!("Failed to list volumes: {}", e))?;

    let volumes_total = volumes_response.volumes.unwrap_or_default().len();

    // Get networks
    let networks = docker
        .list_networks(Some(ListNetworksOptions::<String> {
            ..Default::default()
        }))
        .await
        .map_err(|e| format!("Failed to list networks: {}", e))?;

    Ok(DockerSystemInfo {
        containers_running,
        containers_stopped,
        containers_total,
        images_total: images.len(),
        volumes_total,
        networks_total: networks.len(),
    })
}

#[tauri::command]
async fn remove_container(container_id: String, force: Option<bool>) -> Result<String, String> {
    let docker = Docker::connect_with_socket_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    let options = Some(RemoveContainerOptions {
        force: force.unwrap_or(false),
        ..Default::default()
    });

    docker
        .remove_container(&container_id, options)
        .await
        .map_err(|e| format!("Failed to remove container: {}", e))?;

    Ok(format!("Container {} removed successfully", container_id))
}

#[tauri::command]
async fn pause_container(container_id: String) -> Result<String, String> {
    let docker = Docker::connect_with_socket_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    docker
        .pause_container(&container_id)
        .await
        .map_err(|e| format!("Failed to pause container: {}", e))?;

    Ok(format!("Container {} paused successfully", container_id))
}

#[tauri::command]
async fn unpause_container(container_id: String) -> Result<String, String> {
    let docker = Docker::connect_with_socket_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    docker
        .unpause_container(&container_id)
        .await
        .map_err(|e| format!("Failed to unpause container: {}", e))?;

    Ok(format!("Container {} unpaused successfully", container_id))
}

#[tauri::command]
async fn get_container_stats(container_id: String) -> Result<ContainerStats, String> {
    // For now, return mock data to get the app working
    // Real implementation would use Docker stats API
    Ok(ContainerStats {
        id: container_id.clone(),
        name: format!("container-{}", &container_id[..8]),
        cpu_percentage: 2.5, // Mock CPU usage
        memory_usage: 256 * 1024 * 1024, // 256MB
        memory_limit: 1024 * 1024 * 1024, // 1GB
        memory_percentage: 25.0,
        network_rx: 1024 * 1024, // 1MB
        network_tx: 512 * 1024,  // 512KB
        block_read: 2 * 1024 * 1024, // 2MB
        block_write: 1024 * 1024,    // 1MB
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet, 
            list_containers, start_container, stop_container, restart_container, remove_container, pause_container, unpause_container,
            list_images, remove_image,
            list_volumes, remove_volume,
            list_networks, remove_network,
            execute_command, get_current_directory, change_directory, execute_docker_command,
            get_system_stats, get_docker_system_info, get_container_stats
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
