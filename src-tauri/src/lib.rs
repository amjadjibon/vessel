use bollard::Docker;
use bollard::container::{ListContainersOptions, RemoveContainerOptions, LogsOptions};
use bollard::image::ListImagesOptions;
use bollard::volume::ListVolumesOptions;
use bollard::network::ListNetworksOptions;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;
use tokio::process::Command as TokioCommand;
use sysinfo::System;
// use tokio::time::{timeout, Duration};
use futures_util::StreamExt;
use tauri::Emitter;

#[derive(Debug, Serialize, Deserialize)]
pub struct ContainerInfo {
    pub id: String,
    pub name: String,
    pub image: String,
    pub status: String,
    pub state: String,
    pub created: i64,
    pub ports: Vec<PortInfo>,
    pub project: Option<String>,
    pub service: Option<String>,
    pub labels: HashMap<String, String>,
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
    pub size: u64,
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

            // Extract labels from container
            let labels = container.labels.unwrap_or_default();
            
            // Extract project name from Docker Compose labels
            let project = labels.get("com.docker.compose.project")
                .or_else(|| labels.get("com.docker.compose.project.name"))
                .cloned();
                
            // Extract service name from Docker Compose labels
            let service = labels.get("com.docker.compose.service")
                .cloned();

            ContainerInfo {
                id: container.id.unwrap_or_else(|| "unknown".to_string()),
                name,
                image: container.image.unwrap_or_else(|| "unknown".to_string()),
                status: container.status.unwrap_or_else(|| "unknown".to_string()),
                state: container.state.unwrap_or_else(|| "unknown".to_string()),
                created: container.created.unwrap_or(0),
                ports,
                project,
                service,
                labels,
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

    // Use RemoveImageOptions to properly handle image removal
    let options = Some(bollard::image::RemoveImageOptions {
        force: false,
        noprune: false,
    });

    let result = docker
        .remove_image(&image_id, options, None)
        .await
        .map_err(|e| {
            let error_msg = format!("Failed to remove image: {}", e);
            // Check if it's a dependency error and suggest force removal
            if error_msg.contains("conflict") || error_msg.contains("being used") {
                format!("{}\n\nTip: The image might be in use by a container. Stop and remove dependent containers first, or use force removal.", error_msg)
            } else {
                error_msg
            }
        })?;

    // The result is a vector of removal results
    let removed_count = result.len();
    
    if removed_count > 0 {
        Ok(format!("Image {} removed successfully ({} layers removed)", image_id, removed_count))
    } else {
        Ok(format!("Image {} removed successfully", image_id))
    }
}

#[tauri::command]
async fn force_remove_image(image_id: String) -> Result<String, String> {
    let docker = Docker::connect_with_socket_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    // Use force removal for stubborn images
    let options = Some(bollard::image::RemoveImageOptions {
        force: true,
        noprune: false,
    });

    let result = docker
        .remove_image(&image_id, options, None)
        .await
        .map_err(|e| format!("Failed to force remove image: {}", e))?;

    let removed_count = result.len();
    
    if removed_count > 0 {
        Ok(format!("Image {} force removed successfully ({} layers removed)", image_id, removed_count))
    } else {
        Ok(format!("Image {} force removed successfully", image_id))
    }
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

    // Get all volume sizes using Docker system df
    let volume_sizes = get_all_volume_sizes().await.unwrap_or_default();

    let volume_info: Vec<VolumeInfo> = volumes_response
        .volumes
        .unwrap_or_default()
        .into_iter()
        .map(|volume| {
            // Get size from Docker system df results
            let size = volume_sizes.get(&volume.name).copied().unwrap_or(0);
            
            VolumeInfo {
                name: volume.name,
                driver: volume.driver,
                mountpoint: volume.mountpoint,
                created_at: volume.created_at,
                labels: volume.labels,
                options: volume.options,
                scope: volume.scope.map(|s| s.to_string()).unwrap_or_else(|| "local".to_string()),
                size,
            }
        })
        .collect();

    Ok(volume_info)
}

#[tauri::command]
async fn create_volume(volume_name: String) -> Result<String, String> {
    let docker = Docker::connect_with_socket_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    let config = bollard::volume::CreateVolumeOptions {
        name: volume_name.clone(),
        driver: "local".to_string(),
        ..Default::default()
    };

    docker
        .create_volume(config)
        .await
        .map_err(|e| format!("Failed to create volume: {}", e))?;

    Ok(format!("Volume {} created successfully", volume_name))
}

#[tauri::command]
async fn remove_volume(volume_name: String) -> Result<String, String> {
    println!("Attempting to remove volume: {}", volume_name);
    
    let docker = Docker::connect_with_socket_defaults()
        .map_err(|e| {
            let error_msg = format!("Failed to connect to Docker: {}", e);
            println!("Docker connection error: {}", error_msg);
            error_msg
        })?;

    println!("Connected to Docker, removing volume: {}", volume_name);
    
    docker
        .remove_volume(&volume_name, None)
        .await
        .map_err(|e| {
            let error_msg = format!("Failed to remove volume '{}': {}", volume_name, e);
            println!("Volume removal error: {}", error_msg);
            error_msg
        })?;

    let success_msg = format!("Volume {} removed successfully", volume_name);
    println!("{}", success_msg);
    Ok(success_msg)
}

#[tauri::command]
async fn get_volume_size(volume_name: String) -> Result<u64, String> {
    // Get all volume sizes using Docker system df
    let volume_sizes = get_all_volume_sizes().await?;
    
    // Return the size for the specific volume
    Ok(volume_sizes.get(&volume_name).copied().unwrap_or(0))
}

async fn get_all_volume_sizes() -> Result<HashMap<String, u64>, String> {
    // Use Docker's system df -v command to get accurate volume sizes
    let mut cmd = TokioCommand::new("docker");
    cmd.args(&["system", "df", "-v"]);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let output = cmd.output().await
        .map_err(|e| format!("Failed to execute docker system df: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Docker system df failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut volume_sizes = HashMap::new();
    let mut in_volumes_section = false;

    // Parse the output line by line
    for line in stdout.lines() {
        let trimmed = line.trim();
        
        // Look for the volumes section header
        if trimmed.starts_with("VOLUME NAME") {
            in_volumes_section = true;
            continue;
        }
        
        // Skip empty lines or if not in volumes section
        if !in_volumes_section || trimmed.is_empty() {
            continue;
        }
        
        // Stop if we hit another section
        if trimmed.starts_with("Build Cache") || trimmed.starts_with("REPOSITORY") {
            break;
        }
        
        // Parse volume line: VOLUME_NAME   LINKS   SIZE
        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.len() >= 3 {
            let volume_name = parts[0];
            let size_str = parts[2]; // SIZE is the third column
            
            // Parse size string (e.g., "1.5GB", "256MB", "0B")
            if let Ok(size_bytes) = parse_docker_size(size_str) {
                volume_sizes.insert(volume_name.to_string(), size_bytes);
            }
        }
    }

    Ok(volume_sizes)
}

fn parse_docker_size(size_str: &str) -> Result<u64, String> {
    if size_str == "0B" || size_str == "0" {
        return Ok(0);
    }

    let size_str = size_str.trim();
    let (number_part, unit_part) = if let Some(pos) = size_str.find(|c: char| c.is_alphabetic()) {
        (&size_str[..pos], &size_str[pos..])
    } else {
        (size_str, "B")
    };

    let number: f64 = number_part.parse()
        .map_err(|_| format!("Invalid number in size: {}", size_str))?;

    let multiplier = match unit_part.to_uppercase().as_str() {
        "B" => 1,
        "KB" => 1024,
        "MB" => 1024 * 1024,
        "GB" => 1024 * 1024 * 1024,
        "TB" => 1024_u64.pow(4),
        _ => return Err(format!("Unknown size unit: {}", unit_part)),
    };

    Ok((number * multiplier as f64) as u64)
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
async fn get_home_directory() -> Result<String, String> {
    match std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
        Ok(home) => Ok(home),
        Err(_) => Err("Failed to get home directory".to_string()),
    }
}

#[tauri::command]
async fn set_working_directory(session_id: String, path: String) -> Result<String, String> {
    // For now, we'll just return success. In a real implementation,
    // we'd maintain per-session working directories
    Ok(format!("Working directory set to {} for session {}", path, session_id))
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
    
    // Use placeholder disk values for now - sysinfo disk API has changed
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
    let docker = Docker::connect_with_socket_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    // Get container info first to get the name
    let containers = docker
        .list_containers(Some(ListContainersOptions::<String> {
            all: true,
            filters: {
                let mut filters = HashMap::new();
                filters.insert("id".to_string(), vec![container_id.clone()]);
                filters
            },
            ..Default::default()
        }))
        .await
        .map_err(|e| format!("Failed to get container info: {}", e))?;

    let container_name = containers
        .first()
        .and_then(|c| c.names.as_ref())
        .and_then(|names| names.first())
        .map(|name| name.trim_start_matches('/').to_string())
        .unwrap_or_else(|| format!("container-{}", &container_id[..8]));

    // Get real-time stats from Docker
    let mut stats_stream = docker.stats(&container_id, Some(bollard::container::StatsOptions {
        stream: false,
        one_shot: true,
    }));
    
    if let Some(Ok(stats)) = stats_stream.next().await {
        // Calculate CPU percentage - simplified approach
        let cpu_stats = &stats.cpu_stats;
        let precpu_stats = &stats.precpu_stats;
        
        let cpu_delta = cpu_stats.cpu_usage.total_usage.saturating_sub(precpu_stats.cpu_usage.total_usage);
        let system_delta = cpu_stats.system_cpu_usage.unwrap_or(0).saturating_sub(precpu_stats.system_cpu_usage.unwrap_or(0));
        let online_cpus = cpu_stats.online_cpus.unwrap_or(1) as f64;
        
        let cpu_percentage = if system_delta > 0 && cpu_delta > 0 {
            (cpu_delta as f64 / system_delta as f64) * online_cpus * 100.0
        } else {
            0.0
        };

        // Memory stats
        let memory_usage = stats.memory_stats.usage.unwrap_or(0);
        let memory_limit = stats.memory_stats.limit.unwrap_or(0);
        let memory_percentage = if memory_limit > 0 {
            (memory_usage as f64 / memory_limit as f64) * 100.0
        } else {
            0.0
        };

        // Network stats
        let (network_rx, network_tx) = if let Some(networks) = &stats.networks {
            let mut rx_bytes = 0u64;
            let mut tx_bytes = 0u64;
            
            for (_, network) in networks {
                rx_bytes += network.rx_bytes;
                tx_bytes += network.tx_bytes;
            }
            
            (rx_bytes, tx_bytes)
        } else {
            (0, 0)
        };

        // Block I/O stats
        let (block_read, block_write) = if let Some(io_service_bytes_recursive) = &stats.blkio_stats.io_service_bytes_recursive {
            let mut read_bytes = 0u64;
            let mut write_bytes = 0u64;
            
            for io_stat in io_service_bytes_recursive {
                match io_stat.op.as_str() {
                    "read" | "Read" => read_bytes += io_stat.value,
                    "write" | "Write" => write_bytes += io_stat.value,
                    _ => {}
                }
            }
            
            (read_bytes, write_bytes)
        } else {
            (0, 0)
        };

        Ok(ContainerStats {
            id: container_id,
            name: container_name,
            cpu_percentage,
            memory_usage,
            memory_limit,
            memory_percentage,
            network_rx,
            network_tx,
            block_read,
            block_write,
        })
    } else {
        Err("Failed to get container stats".to_string())
    }
}

#[tauri::command]
async fn get_container_logs(container_id: String, tail: Option<u64>, follow: Option<bool>) -> Result<String, String> {
    let docker = Docker::connect_with_socket_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    let tail_value = tail.unwrap_or(0);
    let logs_options = LogsOptions::<String> {
        stdout: true,
        stderr: true,
        timestamps: true,
        tail: if tail_value == 0 { "all".to_string() } else { tail_value.to_string() },
        follow: follow.unwrap_or(false),
        ..Default::default()
    };

    let mut log_stream = docker.logs(&container_id, Some(logs_options));
    let mut logs = String::new();

    // Collect logs from the stream
    while let Some(log_result) = log_stream.next().await {
        match log_result {
            Ok(log_output) => {
                // Convert log output to string
                let bytes = log_output.into_bytes();
                let log_str = String::from_utf8_lossy(&bytes);
                
                // Clean up Docker log format - remove the first 8 bytes which contain Docker headers
                let cleaned_log = if bytes.len() > 8 {
                    String::from_utf8_lossy(&bytes[8..])
                } else {
                    log_str
                };
                
                logs.push_str(&cleaned_log);
            }
            Err(e) => {
                eprintln!("Error reading log: {}", e);
                break;
            }
        }
        
        // If not following, break after collecting initial logs
        if !follow.unwrap_or(false) {
            break;
        }
    }

    Ok(logs)
}

#[tauri::command]
async fn start_log_stream(container_id: String, app_handle: tauri::AppHandle) -> Result<String, String> {
    let docker = Docker::connect_with_socket_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    let logs_options = LogsOptions::<String> {
        stdout: true,
        stderr: true,
        timestamps: true,
        tail: "all".to_string(),
        follow: true, // This enables streaming
        ..Default::default()
    };

    let container_id_clone = container_id.clone();
    let app_handle_clone = app_handle.clone();

    // Spawn a background task to stream logs
    tokio::spawn(async move {
        let mut log_stream = docker.logs(&container_id_clone, Some(logs_options));
        
        while let Some(log_result) = log_stream.next().await {
            match log_result {
                Ok(log_output) => {
                    // Convert log output to string
                    let bytes = log_output.into_bytes();
                    
                    // Clean up Docker log format - remove the first 8 bytes which contain Docker headers
                    let cleaned_log = if bytes.len() > 8 {
                        String::from_utf8_lossy(&bytes[8..])
                    } else {
                        String::from_utf8_lossy(&bytes)
                    };
                    
                    // Emit the log line to the frontend
                    if let Err(e) = app_handle_clone.emit(&format!("log-stream-{}", container_id_clone), cleaned_log.to_string()) {
                        eprintln!("Failed to emit log event: {}", e);
                        break;
                    }
                }
                Err(e) => {
                    eprintln!("Error reading log stream: {}", e);
                    // Emit error event
                    let _ = app_handle_clone.emit(&format!("log-stream-error-{}", container_id_clone), format!("Log stream error: {}", e));
                    break;
                }
            }
        }
        
        // Emit stream ended event
        let _ = app_handle_clone.emit(&format!("log-stream-ended-{}", container_id_clone), "Log stream ended");
    });

    Ok("Log stream started".to_string())
}

#[tauri::command]
async fn stop_log_stream(container_id: String, app_handle: tauri::AppHandle) -> Result<String, String> {
    // Emit stop signal
    let _ = app_handle.emit(&format!("log-stream-stop-{}", container_id), "Stream stopped");
    Ok("Log stream stop signal sent".to_string())
}

#[tauri::command]
async fn inspect_container(container_id: String) -> Result<serde_json::Value, String> {
    let docker = Docker::connect_with_socket_defaults()
        .map_err(|e| format!("Failed to connect to Docker: {}", e))?;

    let inspect_result = docker
        .inspect_container(&container_id, None)
        .await
        .map_err(|e| format!("Failed to inspect container: {}", e))?;

    // Convert the inspect result to a JSON value for easy frontend handling
    serde_json::to_value(inspect_result)
        .map_err(|e| format!("Failed to serialize inspect data: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet, 
            list_containers, start_container, stop_container, restart_container, remove_container, pause_container, unpause_container,
            list_images, remove_image, force_remove_image,
            list_volumes, create_volume, remove_volume, get_volume_size,
            list_networks, remove_network,
            execute_command, get_current_directory, get_home_directory, set_working_directory, change_directory, execute_docker_command,
            get_system_stats, get_docker_system_info, get_container_stats, get_container_logs, start_log_stream, stop_log_stream, inspect_container
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
