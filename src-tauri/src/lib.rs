use bollard::Docker;
use bollard::container::ListContainersOptions;
use serde::{Deserialize, Serialize};

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, list_containers, start_container, stop_container, restart_container])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
