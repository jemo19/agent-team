terraform {
  required_version = ">= 1.6.0"
}

variable "service_name" {
  description = "Synthetic fixture service name."
  type        = string
  default     = "fixture-api"
}

locals {
  label = "${var.service_name}-local"
}

output "label" {
  description = "Non-sensitive synthetic output."
  value       = local.label
}

output "service_name" {
  description = "Non-sensitive synthetic service name."
  value       = var.service_name
}
