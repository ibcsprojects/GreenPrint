import { useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../store'
import { FlagCard } from './FlagCard'
import { logoUrl } from '../logo'

export function FlagList() {
  const flags = useStore((s) => s.flags)
  const loading = useStore((s) => s.loading)
  const sortMode = useStore((s) => s.sortMode)
  const doc = useStore((s) => s.doc)

  // Only one card is open at a time (accordion).
  const [openId, setOpenId] = useState<string | null>(null)

  if (loading && flags.length === 0) {
    return (
      <div className="grid place-items-center px-6 py-10 text-center">
        <div className="relative grid h-12 w-12 place-items-center">
          <motion.span
            className="absolute h-12 w-12 rounded-full border-2 border-leaf-100 border-t-leaf-600"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.9, ease: 'linear', repeat: Infinity }}
            aria-hidden
          />
          <img src={logoUrl()} alt="" className="h-5 w-5" />
        </div>
        <p className="mt-3 text-[13px] font-medium text-bark-900">Checking this document</p>
        <p className="mt-0.5 text-[12px] text-bark-700/80">Looking for ways to save pages and ink.</p>
      </div>
    )
  }

  if (!doc) return null

  if (flags.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-[13px] font-semibold text-leaf-800">No print waste found</p>
        <p className="mx-auto mt-1 max-w-[16rem] text-[12px] text-bark-700/80">
          Every issue is fixed or dismissed. This document is ready to print.
        </p>
      </div>
    )
  }

  const ordered = [...flags].sort((a, b) => a.range.start - b.range.start)
  if (sortMode === 'savings') {
    // Biggest page saving first; ties keep document order (stable sort).
    ordered.sort((a, b) => b.impact.paper - a.impact.paper)
  } else {
    // Document order, but the margins recommendation always leads.
    ordered.sort((a, b) => Number(b.type === 'wideMargins') - Number(a.type === 'wideMargins'))
  }

  return (
    <ul className="space-y-2 p-3">
      {ordered.map((flag) => (
        <li key={flag.id}>
          <FlagCard
            flag={flag}
            expanded={openId === flag.id}
            onToggle={(open) => setOpenId(open ? flag.id : null)}
          />
        </li>
      ))}
    </ul>
  )
}
