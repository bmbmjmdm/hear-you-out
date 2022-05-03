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
        <Text style={[styles.buttonText, styles.primaryText]}>No</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.confirmButton} activeOpacity={0.3} onPress={genericModalConfirmCallback}>
        <Text style={styles.buttonText}>Yes</Text>
      </TouchableOpacity>
    </View>
  ) : (
    <View style={styles.modalOneButton}>
      <TouchableOpacity style={styles.cancelButton} activeOpacity={0.3} onPress={() => closeModal}>
        <Text style={[styles.buttonText, styles.primaryText]}>Ok</Text>
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
  modalInner: {
    width: 320, 
  },

  modalOuter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },

  tooltipOuter: {
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
    zIndex: 1
  },

  modalText: {
    fontSize: 25,
    color: "#F0F3F5",
    textAlign: 'center',
    backgroundColor: '#191919',
    borderRadius: 20,
    padding: 10,
    paddingVertical: 15,
    borderColor: '#F0F3F5',
    overflow: "hidden",
    borderWidth: 3,
  },

  buttonText: {
    fontSize: 25,
    fontWeight: 'bold'
  },

  confirmButton: {
    width: 100,
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#F0F3F5',
  },

  primaryText: {
    color: "#F0F3F5",
  },

  cancelButton: {
    width: 100,
    alignItems: 'center',
    padding: 13,
    borderRadius: 20,
    backgroundColor: '#191919',
    borderColor: '#F0F3F5',
    borderWidth: 2,
  },
  
  modalButtons: {
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
    marginTop: 30
  },

  modalOneButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30
  }
})

export default ModalContents