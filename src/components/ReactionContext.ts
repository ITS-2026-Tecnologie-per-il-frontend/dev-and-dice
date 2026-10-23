import {createContext} from 'react'
import type {ReactionEvent} from '../utils/PlayApi'
export const ReactionContext=createContext({paused:false,before:async(_event:ReactionEvent)=>true,ready:(_snapshot:string)=>{}})
