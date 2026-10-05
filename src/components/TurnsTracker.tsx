import { useState } from "react";

class Turn {
    description: string;
    initiative: number;

    constructor(description: string, initiative: number) {
        this.description = description;
        this.initiative = initiative;
    }
}

export function TurnsTracker () {
    const [turns, turnsSate] = useState ([Turn])

    return (
        <div></div>
    );
}