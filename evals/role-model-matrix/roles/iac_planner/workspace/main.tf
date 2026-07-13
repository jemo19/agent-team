terraform {
  required_version = ">= 1.8.0"
  backend "remote" {
    organization = "demo-only"
    workspaces { name = "dns-production" }
  }
}

resource "cloudflare_record" "app" {
  zone_id = "zone-demo"
  name    = "app.example.test"
  type    = "CNAME"
  value   = "edge.example.test"
  ttl     = 300
  proxied = false
}
