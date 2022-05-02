import {View, StyleSheet, Text, TouchableOpacity} from 'react-native'
import React from 'react'

type ModalContentsProps = {
  type: "generic" | "approve" | "disapprove",
  closeModal?: () => void,
  onApprove?: () => void,
  onShare?: () => void,
  onDisapprove?: () => void,
  onReport?: () => void,
  genericModalConfirmCallback?: () => void,
  text?: string,
}

const ModalContents = ({ 
  text,
  type,
  closeModal,
  onApprove,
  onShare,
  onDisapprove,
  onReport,
  genericModalConfirmCallback,
 } : ModalContentsProps) => {
  const genericButtons = genericModalConfirmCallback ? (
    <View style={styles.modalButtons}>
      <TouchableOpacity style={styles.cancelButton} activeOpacity={0.3} onPress={() => closeModal}>
        <Text style={styles.buttonText}>No</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.confirmButton} activeOpacity={0.3} onPress={genericModalConfirmCallback}>
        <Text style={styles.buttonText}>Yes</Text>
      </TouchableOpacity>
    </View>
  ) : (
    <View style={styles.modalOneButton}>
      <TouchableOpacity style={styles.cancelButton} activeOpacity={0.3} onPress={() => closeModal}>
        <Text style={styles.buttonText}>Ok</Text>
      </TouchableOpacity>
    </View>
  )

  const approveButtons = (
    <View style={styles.modalButtons}>
      <TouchableOpacity style={styles.} activeOpacity={0.3} onPress={() => onShare()}>
        {/** TODO add share icon button */}
      </TouchableOpacity>
      <TouchableOpacity style={styles.} activeOpacity={0.3} onPress={() => onApprove()}>
        {/** TODO add approve icon button */}
      </TouchableOpacity>
    </View>
  )

  const disapproveButtons = (
    <View style={styles.modalButtons}>
      <TouchableOpacity style={styles.} activeOpacity={0.3} onPress={() => onReport()}>
        {/** TODO add report icon button */}
      </TouchableOpacity>
      <TouchableOpacity style={styles.} activeOpacity={0.3} onPress={() => onDisapprove()}>
        {/** TODO add disapprove icon button */}
      </TouchableOpacity>
    </View>
  )

  const finalText =
    type === "generic"
    ? text
    : type === "approve"
    ? "If this answer changed or challenged your view, consider sharing it! Be sure to do this in the future too!"
    : "If this answer was innappropriate or low-effort, flag it! Be sure to do this in the future too!"
 
  return (
    <View style={styles.modalOuter}>
      <View style={styles.modalInner}>
        <Text style={styles.modalText}>{finalText}</Text>
        {type === "generic" && genericButtons}
        {type === "approve" && approveButtons}
        {type === "disapprove" && disapproveButtons}
      </View>
    </View>
  )
}


const styles = StyleSheet.create({
  modalOuter: {},
  modalInner: {},
  modalText: {},
  modalButtons: {},
  cancelButton: {},
  buttonText: {},
  confirmButton: {},
  modalOneButton: {}
})

export default ModalContents