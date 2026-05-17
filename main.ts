#!/usr/bin/env -S deno run --allow-net --allow-run --allow-read

import '@total-typescript/ts-reset'
import { z } from 'zod'

interface VolumeState {
  volume: number
  muted: boolean
}

const streamDeckMessageSchema = z.object({
  event: z.string(),
  context: z.string(),
})

function getArg(name: string): string {
  const index = Deno.args.findIndex((a) => a.toLowerCase() === name.toLowerCase())
  const value = Deno.args[index + 1]
  if (index === -1) {
    throw new Error(`Missing CLI flag: ${name}`)
  }
  if (value === undefined) {
    throw new Error(`Missing value for CLI flag: ${name}`)
  }
  return value
}

const port = parseInt(getArg('-port'))
const pluginUUID = getArg('-pluginUUID')
const registerEvent = getArg('-registerEvent')

const activeContexts = new Set<string>()

function getVolumeState(): Promise<VolumeState> {
  switch (Deno.build.os) {
    case 'darwin':
      return getMacVolumeState()
    case 'windows':
      return getWindowsVolumeState()
    default:
      return getLinuxVolumeState()
  }
}

async function getMacVolumeState(): Promise<VolumeState> {
  const cmd = new Deno.Command('osascript', {
    args: ['-e', 'get volume settings'],
    stdout: 'piped',
    stderr: 'null',
  })
  const { stdout } = await cmd.output()
  const text = new TextDecoder().decode(stdout).trim()
  // e.g. "output volume:75, input volume:50, alert volume:100, output muted:false"
  const volume = parseInt(text.match(/output volume:(\d+)/)?.[1] ?? '0')
  const muted = text.match(/output muted:(true|false)/)?.[1] === 'true'
  return { volume, muted }
}

async function getWindowsVolumeState(): Promise<VolumeState> {
  // pathname is /C:/... on Windows, so strip the leading slash
  const psScript = new URL('windows-audio.ps1', import.meta.url).pathname.slice(
    1,
  )
  const cmd = new Deno.Command('powershell', {
    args: ['-NoProfile', '-NonInteractive', '-File', psScript],
    stdout: 'piped',
    stderr: 'null',
  })
  const { stdout } = await cmd.output()
  const text = new TextDecoder().decode(stdout).trim()
  const [volStr, muteStr] = text.split(' ')
  return {
    volume: parseInt(volStr ?? '0'),
    muted: muteStr === 'true',
  }
}

async function getLinuxVolumeState(): Promise<VolumeState> {
  // Requires pactl (PulseAudio / PipeWire compatibility layer)
  const [volResult, muteResult] = await Promise.all([
    new Deno.Command('pactl', {
      args: ['get-sink-volume', '@DEFAULT_SINK@'],
      stdout: 'piped',
      stderr: 'null',
    }).output(),
    new Deno.Command('pactl', {
      args: ['get-sink-mute', '@DEFAULT_SINK@'],
      stdout: 'piped',
      stderr: 'null',
    }).output(),
  ])
  const volText = new TextDecoder().decode(volResult.stdout).trim()
  const muteText = new TextDecoder().decode(muteResult.stdout).trim()
  // e.g. "Volume: front-left: 65536 / 100% / 0.00 dB, ..."
  const volume = parseInt(volText.match(/(\d+)%/)?.[1] ?? '0')
  // e.g. "Mute: no"
  const muted = muteText.includes('Mute: yes')
  return { volume, muted }
}

function buildImage({ volume, muted }: VolumeState): string {
  const barWidth = Math.round(52 * volume / 100)
  const barColor = volume > 70 ? 'white' : volume > 40 ? '#4a9eff' : '#69d46e'
  const svg = muted
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72">
  <rect width="72" height="72" rx="10" fill="#1a1a2e"/>
  <rect x="10" y="42" width="52" height="10" rx="3" fill="#333"/>
  <text x="36" y="34" font-family="sans-serif" font-size="20" font-weight="bold" fill="#888" text-anchor="middle">MUTE</text>
  <text x="36" y="64" font-family="sans-serif" font-size="9" fill="#888" text-anchor="middle">volume</text>
  <line x1="10" y1="10" x2="62" y2="62" stroke="#ff6b6b" stroke-width="3" stroke-linecap="round"/>
</svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72">
  <rect width="72" height="72" rx="10" fill="#1a1a2e"/>
  <rect x="10" y="42" width="52" height="10" rx="3" fill="#333"/>
  <rect x="10" y="42" width="${barWidth}" height="10" rx="3" fill="${barColor}"/>
  <text x="36" y="34" font-family="sans-serif" font-size="20" font-weight="bold" fill="white" text-anchor="middle">${volume}%</text>
  <text x="36" y="64" font-family="sans-serif" font-size="9" fill="#888" text-anchor="middle">volume</text>
</svg>`
  return 'data:image/svg+xml;base64,' + btoa(svg)
}

const ws = new WebSocket(`ws://localhost:${port}`)

ws.onopen = () => ws.send(JSON.stringify({ event: registerEvent, uuid: pluginUUID }))

ws.onmessage = (event) => {
  const result = streamDeckMessageSchema.safeParse(JSON.parse(event.data))
  if (!result.success) {
    console.error('Failed to parse WebSocket message:', result.error)
    return
  }
  const msg = result.data
  if (msg.event === 'willAppear') {
    activeContexts.add(msg.context)
  } else if (msg.event === 'willDisappear') {
    activeContexts.delete(msg.context)
  }
}

ws.onerror = (err) => console.error('WebSocket error:', err)

setInterval(async () => {
  if (activeContexts.size === 0) {
    return
  }
  const state = await getVolumeState()
  const image = buildImage(state)
  for (const context of activeContexts) {
    ws.send(JSON.stringify({ event: 'setImage', context, payload: { image } }))
  }
}, 500)
