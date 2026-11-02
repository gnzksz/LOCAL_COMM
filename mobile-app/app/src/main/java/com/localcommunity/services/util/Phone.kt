package com.localcommunity.services.util

/** Philippine mobile numbers: formatting while typing, and a check. Same rules as the website. */
object Phone {
    /** "09171234567" -> "0917 123 4567";  "+639171234567" -> "+63 917 123 4567" */
    fun format(raw: String): String {
        val text = raw.trim()
        val all = text.filter { it.isDigit() }
        val international = text.startsWith("+") || all.startsWith("63")
        if (international) {
            val digits = (if (all.startsWith("63")) all.drop(2) else all).take(10)
            if (digits.isEmpty()) return if (text.startsWith("+")) "+" else ""
            val groups = listOf(digits.take(3), digits.drop(3).take(3), digits.drop(6).take(4)).filter { it.isNotEmpty() }
            return "+63 " + groups.joinToString(" ")
        }
        val digits = all.take(11)
        return listOf(digits.take(4), digits.drop(4).take(3), digits.drop(7).take(4)).filter { it.isNotEmpty() }.joinToString(" ")
    }

    /** null when the number is fine (or empty), otherwise a message for the user. */
    fun problem(value: String): String? {
        if (value.isBlank()) return null
        val compact = value.filter { !it.isWhitespace() }
        return if (Regex("^(09\\d{9}|\\+639\\d{9})$").matches(compact)) null
        else "Enter a mobile number like 0917 123 4567 or +63 917 123 4567."
    }
}
