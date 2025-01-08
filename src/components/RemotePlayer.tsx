import Character from './Character';
import { PlayerState } from '../types/multiplayer';

interface RemotePlayerProps {
  state: PlayerState;
}

export function RemotePlayer({ state }: RemotePlayerProps) {
  console.log("Rendering remote player:", { 
    id: state.id,
    position: state.position,
    animation: state.animation 
});

  return (
    <Character 
    isLocalPlayer={false}
    remoteState={state}
    camera={null!} // Or pass a dummy camera if required
    // Add all other required props with default values
    isNearIdol={false}
    isAscending={false}
    onPositionUpdate={() => {}}
    onRotationUpdate={() => {}}
    isHoldingTomato={false}
    isNearTomato={false}
    isNearNPC={false}
    canAscend={false}
    />
  );
}