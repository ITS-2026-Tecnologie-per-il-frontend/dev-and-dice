import { useState } from 'react'
import { TurnsTracker } from './components/TurnsTracker'
import { SheetsTracker } from './components/SheetsTracker'
import { AbilitiesTracker } from './components/AbilitiesTracker'
import './App.css'

function App() {
  return (
    <div>
      <TurnsTracker />

      <SheetsTracker />

      <AbilitiesTracker />
    </div>
  )
}

export default App
